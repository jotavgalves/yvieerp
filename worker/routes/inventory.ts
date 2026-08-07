import { integer, makeId, now, nullable, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

interface AdjustmentPayload {
  quantity?: number;
  reason?: string;
  note?: string;
}

interface EntryItemPayload {
  variantId?: string;
  color?: string;
  size?: string;
  quantity?: number;
  unitCost?: number;
  salePrice?: number;
  sku?: string;
  minStock?: number;
}

interface EntryPayload {
  productId?: string;
  description?: string;
  entryDate?: string;
  items?: EntryItemPayload[];
}

export async function adjustStock(request: Request, env: Env, variantId: string) {
  const input = await readJson<AdjustmentPayload>(request);
  const variant = await env.DB.prepare(`SELECT * FROM product_variants WHERE id=?`).bind(variantId).first<any>();
  if (!variant) return fail('Variante não encontrada.', 404);

  const next = integer(input.quantity);
  const delta = next - number(variant.stock);
  if (delta === 0) return json({ ok: true });
  const timestamp = now();
  const note = [String(input.reason || 'Ajuste'), String(input.note || '').trim()].filter(Boolean).join(' · ');

  await env.DB.batch([
    env.DB.prepare(`UPDATE product_variants SET stock=?,updated_at=? WHERE id=?`).bind(next, timestamp, variantId),
    env.DB.prepare(`
      INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at)
      VALUES(?,?,?,?,?,?,?,?)
    `).bind(makeId('mov'), variant.product_id, variantId, 'Ajuste', delta, variant.average_cost, note, timestamp),
  ]);
  return json({ ok: true });
}

export async function createStockEntry(request: Request, env: Env) {
  const input = await readJson<EntryPayload>(request);
  const productId = String(input.productId || '');
  const items = (Array.isArray(input.items) ? input.items : []).filter(item => integer(item.quantity) > 0);
  if (!productId || !items.length) return fail('Produto e ao menos uma quantidade são obrigatórios.');

  const product = await env.DB.prepare(`SELECT id,status FROM products WHERE id=?`).bind(productId).first<{ id: string; status: string }>();
  if (!product) return fail('Produto não encontrado.', 404);
  if (product.status === 'Arquivado') return fail('Não é possível registrar entrada em um produto arquivado.', 409);

  const variantRows = await env.DB.prepare(`SELECT id FROM product_variants WHERE product_id=? AND active=1`).bind(productId).all<{ id: string }>();
  const allowedVariantIds = new Set((variantRows.results || []).map(variant => variant.id));
  for (const item of items) {
    if (item.variantId && !allowedVariantIds.has(String(item.variantId))) {
      return fail('Uma variante não pertence ao produto selecionado ou está inativa.', 409);
    }
  }

  const entryId = makeId('ent');
  const timestamp = now();
  const totalUnits = items.reduce((sum, item) => sum + integer(item.quantity), 0);
  const totalCost = items.reduce((sum, item) => sum + integer(item.quantity) * Math.max(0, number(item.unitCost)), 0);
  const entryDate = String(input.entryDate || new Date().toISOString().slice(0, 10));
  const description = String(input.description || 'Entrada de estoque').trim() || 'Entrada de estoque';

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO stock_entries(id,product_id,description,entry_date,total_units,total_cost,created_at)
      VALUES(?,?,?,?,?,?,?)
    `).bind(entryId, productId, description, entryDate, totalUnits, totalCost, timestamp),
  ];

  for (const item of items) {
    let variantId = String(item.variantId || '');
    const quantity = integer(item.quantity);
    const unitCost = Math.max(0, number(item.unitCost));
    const salePrice = Math.max(0, number(item.salePrice));

    if (variantId) {
      statements.push(env.DB.prepare(`
        UPDATE product_variants
        SET average_cost = CASE
              WHEN stock + ? > 0 THEN ((stock * average_cost) + (? * ?)) / (stock + ?)
              ELSE ?
            END,
            stock = stock + ?,
            sale_price = ?,
            sku = COALESCE(?, sku),
            min_stock = ?,
            updated_at = ?
        WHERE id=? AND product_id=? AND active=1
      `).bind(
        quantity, quantity, unitCost, quantity, unitCost,
        quantity, salePrice, nullable(item.sku), integer(item.minStock, 1), timestamp,
        variantId, productId,
      ));
    } else {
      variantId = makeId('var');
      statements.push(env.DB.prepare(`
        INSERT INTO product_variants(
          id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price,active,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)
      `).bind(
        variantId, productId, nullable(item.color), nullable(item.size), nullable(item.sku), quantity,
        integer(item.minStock, 1), unitCost, salePrice, timestamp, timestamp,
      ));
    }

    statements.push(env.DB.prepare(`
      INSERT INTO stock_entry_items(id,entry_id,variant_id,quantity,unit_cost,sale_price)
      VALUES(?,?,?,?,?,?)
    `).bind(makeId('eni'), entryId, variantId, quantity, unitCost, salePrice));

    statements.push(env.DB.prepare(`
      INSERT INTO inventory_movements(
        id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?)
    `).bind(makeId('mov'), productId, variantId, 'Entrada', quantity, unitCost, 'stock_entry', entryId, description, timestamp));
  }

  await env.DB.batch(statements);
  return json({ id: entryId }, 201);
}
