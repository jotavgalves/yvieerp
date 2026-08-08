import { integer, makeId, now, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

interface PurchaseItemPayload { variantId?: string; quantity?: number; unitCost?: number }
interface PurchasePayload {
  supplierId?: string;
  purchaseDate?: string;
  freightCost?: number;
  otherCost?: number;
  notes?: string;
  items?: PurchaseItemPayload[];
}

function purchaseNumber() {
  return `CMP-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function createPurchase(request: Request, env: Env) {
  const input = await readJson<PurchasePayload>(request);
  const supplierId = String(input.supplierId || '');
  const items = (Array.isArray(input.items) ? input.items : []).filter(i => String(i.variantId || '') && integer(i.quantity) > 0);
  if (!supplierId || !items.length) return fail('Fornecedor e ao menos um item são obrigatórios.');

  const supplier = await env.DB.prepare(`SELECT id,active FROM suppliers WHERE id=?`).bind(supplierId).first<{id:string;active:number}>();
  if (!supplier || !supplier.active) return fail('Fornecedor não encontrado ou inativo.', 404);

  const normalized: Array<{variantId:string;productId:string;quantity:number;unitCost:number}> = [];
  for (const item of items) {
    const variantId = String(item.variantId);
    const variant = await env.DB.prepare(`SELECT v.id,v.product_id,v.active,p.status AS product_status FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=?`).bind(variantId).first<any>();
    if (!variant || !variant.active || variant.product_status!=='Ativo') return fail('Uma das variantes não existe ou pertence a um produto inativo.', 409);
    normalized.push({ variantId, productId: variant.product_id, quantity: integer(item.quantity), unitCost: Math.max(0, number(item.unitCost)) });
  }

  const subtotal = normalized.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  const freight = Math.max(0, number(input.freightCost));
  const other = Math.max(0, number(input.otherCost));
  const totalUnits = normalized.reduce((sum, i) => sum + i.quantity, 0);
  const id = makeId('pur');
  const createdAt = now();
  const numberCode = purchaseNumber();
  const purchaseDate = String(input.purchaseDate || createdAt.slice(0, 10));
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO purchases(id,number,supplier_id,purchase_date,status,items_subtotal,freight_cost,other_cost,total_cost,total_units,notes,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(id, numberCode, supplierId, purchaseDate, 'Pedido', subtotal, freight, other, subtotal + freight + other, totalUnits, String(input.notes || '').trim() || null, createdAt, createdAt),
  ];
  normalized.forEach(item => statements.push(env.DB.prepare(`
    INSERT INTO purchase_items(id,purchase_id,product_id,variant_id,quantity,unit_cost)
    VALUES(?,?,?,?,?,?)
  `).bind(makeId('pui'), id, item.productId, item.variantId, item.quantity, item.unitCost)));
  await env.DB.batch(statements);
  return json({ id, number: numberCode }, 201);
}

export async function receivePurchase(env: Env, id: string) {
  const purchase = await env.DB.prepare(`
    SELECT p.*,s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?
  `).bind(id).first<any>();
  if (!purchase) return fail('Compra não encontrada.', 404);
  if (purchase.status === 'Recebido') return fail('Esta compra já foi recebida.', 409);
  if (purchase.status === 'Cancelado') return fail('Uma compra cancelada não pode ser recebida.', 409);

  const result = await env.DB.prepare(`
    SELECT pi.*,v.stock,v.average_cost,v.sale_price,v.active,p.name AS product_name,p.status AS product_status
    FROM purchase_items pi
    JOIN product_variants v ON v.id=pi.variant_id
    JOIN products p ON p.id=pi.product_id
    WHERE pi.purchase_id=?
    ORDER BY pi.rowid
  `).bind(id).all<any>();
  const items = result.results || [];
  if (!items.length) return fail('A compra não possui itens.', 409);
  if (items.some(i => !i.active || i.product_status!=='Ativo')) return fail('Um produto ou variante desta compra foi desativado. Reative-o antes do recebimento.', 409);

  const baseSubtotal = Number(purchase.items_subtotal || 0);
  const extra = Number(purchase.freight_cost || 0) + Number(purchase.other_cost || 0);
  const totalUnits = items.reduce((sum, i) => sum + Number(i.quantity), 0);
  const timestamp = now();
  const entryDate = timestamp.slice(0, 10);
  const description = `${purchase.number} · ${purchase.supplier_name}`;
  const enriched = items.map(item => {
    const qty = Number(item.quantity);
    const unitCost = Number(item.unit_cost);
    const landed = baseSubtotal > 0
      ? unitCost + (extra * (qty * unitCost / baseSubtotal)) / qty
      : unitCost + (totalUnits > 0 ? extra / totalUnits : 0);
    return {...item, qty, unitCost, landed};
  });

  const byProduct = new Map<string, any[]>();
  enriched.forEach(item => {
    const arr = byProduct.get(item.product_id) || [];
    arr.push(item);
    byProduct.set(item.product_id, arr);
  });

  const statements: D1PreparedStatement[] = [env.DB.prepare(`INSERT INTO operation_guards(operation_key,created_at) VALUES(?,?)`).bind(`purchase-receive:${id}`,timestamp)];
  for (const [productId, productItems] of byProduct.entries()) {
    const entryId = makeId('ent');
    const productUnits = productItems.reduce((sum, i) => sum + i.qty, 0);
    const productCost = productItems.reduce((sum, i) => sum + i.qty * i.landed, 0);
    statements.push(env.DB.prepare(`
      INSERT INTO stock_entries(id,product_id,description,entry_date,total_units,total_cost,created_at)
      VALUES(?,?,?,?,?,?,?)
    `).bind(entryId, productId, description, entryDate, productUnits, productCost, timestamp));

    for (const item of productItems) {
      statements.push(env.DB.prepare(`
        UPDATE product_variants
        SET average_cost = CASE
              WHEN stock + ? > 0 THEN ((stock * average_cost) + (? * ?)) / (stock + ?)
              ELSE ?
            END,
            stock = stock + ?, updated_at=?
        WHERE id=?
      `).bind(item.qty, item.qty, item.landed, item.qty, item.landed, item.qty, timestamp, item.variant_id));
      statements.push(env.DB.prepare(`
        INSERT INTO stock_entry_items(id,entry_id,variant_id,quantity,unit_cost,sale_price)
        VALUES(?,?,?,?,?,?)
      `).bind(makeId('eni'), entryId, item.variant_id, item.qty, item.landed, Number(item.sale_price)));
      statements.push(env.DB.prepare(`
        INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)
      `).bind(makeId('mov'), item.product_id, item.variant_id, 'Entrada', item.qty, item.landed, 'purchase', id, description, timestamp));
    }
  }

  statements.push(env.DB.prepare(`UPDATE purchases SET status='Recebido',received_at=?,cancelled_at=NULL,reversed_at=NULL,reversal_reason=NULL,updated_at=? WHERE id=? AND status='Pedido'`).bind(timestamp, timestamp, id));
  await env.DB.batch(statements);
  return json({ ok: true });
}

export async function cancelPurchase(env: Env, id: string) {
  const current = await env.DB.prepare(`SELECT status FROM purchases WHERE id=?`).bind(id).first<{status:string}>();
  if (!current) return fail('Compra não encontrada.', 404);
  if (current.status === 'Recebido') return fail('Esta compra já entrou no estoque. Use Estornar recebimento para desfazer com segurança.', 409);
  if (current.status === 'Cancelado') return json({ ok: true });
  const timestamp=now();
  await env.DB.prepare(`UPDATE purchases SET status='Cancelado',cancelled_at=?,updated_at=? WHERE id=? AND status='Pedido'`).bind(timestamp,timestamp, id).run();
  return json({ ok: true });
}

export async function reversePurchase(env:Env,id:string){
  const purchase=await env.DB.prepare(`SELECT p.*,s.name AS supplier_name FROM purchases p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?`).bind(id).first<any>();
  if(!purchase)return fail('Compra não encontrada.',404);
  if(purchase.reversed_at)return json({ok:true});
  if(purchase.status!=='Recebido')return fail('Somente uma compra recebida pode ter o recebimento estornado.',409);

  const movements=await env.DB.prepare(`
    SELECT m.product_id,m.variant_id,m.quantity,m.unit_cost,v.stock,v.average_cost,p.name AS product_name
    FROM inventory_movements m
    JOIN product_variants v ON v.id=m.variant_id
    JOIN products p ON p.id=m.product_id
    WHERE m.reference_type='purchase' AND m.reference_id=? AND m.type='Entrada'
    ORDER BY m.created_at,m.id
  `).bind(id).all<any>();
  if(!(movements.results||[]).length)return fail('Não foi possível localizar a entrada de estoque vinculada a esta compra.',409);

  const grouped=new Map<string,{productId:string;variantId:string;productName:string;qty:number;value:number;stock:number;averageCost:number}>();
  for(const movement of movements.results||[]){
    const current=grouped.get(movement.variant_id)||{productId:movement.product_id,variantId:movement.variant_id,productName:movement.product_name,qty:0,value:0,stock:Number(movement.stock),averageCost:Number(movement.average_cost)};
    const qty=Number(movement.quantity||0);current.qty+=qty;current.value+=qty*Number(movement.unit_cost||0);grouped.set(movement.variant_id,current);
  }

  for(const row of grouped.values()){
    const later=await env.DB.prepare(`SELECT COUNT(*) n FROM inventory_movements WHERE variant_id=? AND created_at>=? AND NOT(reference_type='purchase' AND reference_id=?)`).bind(row.variantId,purchase.received_at,id).first<any>();
    if(Number(later?.n||0)>0)return fail(`Não é seguro estornar ${purchase.number}: ${row.productName} teve movimentações depois do recebimento. Desfaça essas operações primeiro ou faça uma conferência de estoque.`,409);
    if(row.stock<row.qty)return fail(`Não é possível estornar ${purchase.number}: o estoque atual de ${row.productName} é menor que a quantidade recebida.`,409);
  }

  const timestamp=now();const statements:D1PreparedStatement[]=[env.DB.prepare(`INSERT INTO operation_guards(operation_key,created_at) VALUES(?,?)`).bind(`purchase-reverse:${id}`,timestamp)];
  for(const row of grouped.values()){
    const previousStock=row.stock-row.qty;const previousValue=(row.stock*row.averageCost)-row.value;
    if(previousStock>0&&previousValue<-.01)return fail(`Não foi possível reconstruir com segurança o custo anterior de ${row.productName}. Faça uma conferência de estoque antes.`,409);
    const previousAverage=previousStock>0?Math.max(0,previousValue/previousStock):0;const weightedCost=row.qty>0?row.value/row.qty:0;
    statements.push(env.DB.prepare(`
      UPDATE product_variants
      SET stock=CASE WHEN stock=? AND ABS(average_cost-?)<0.000001 THEN ? ELSE -1 END,
          average_cost=CASE WHEN stock=? AND ABS(average_cost-?)<0.000001 THEN ? ELSE average_cost END,
          updated_at=?
      WHERE id=?
    `).bind(row.stock,row.averageCost,previousStock,row.stock,row.averageCost,previousAverage,timestamp,row.variantId));
    statements.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(makeId('mov'),row.productId,row.variantId,'Cancelamento',-row.qty,weightedCost,'purchase_reversal',id,`Estorno ${purchase.number}`,timestamp));
  }
  const description=`${purchase.number} · ${purchase.supplier_name}`;
  statements.push(env.DB.prepare(`UPDATE stock_entries SET deleted_at=?,deleted_reason=? WHERE description=? AND created_at=? AND deleted_at IS NULL`).bind(timestamp,`Estorno ${purchase.number}`,description,purchase.received_at));
  statements.push(env.DB.prepare(`UPDATE purchases SET status='Cancelado',reversed_at=?,reversal_reason=?,updated_at=? WHERE id=? AND status='Recebido' AND reversed_at IS NULL`).bind(timestamp,'Recebimento estornado',timestamp,id));
  await env.DB.batch(statements);
  return json({ok:true});
}
