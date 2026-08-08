import { integer, makeId, now, nullable, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

interface VariantInput {
  id?: string;
  color?: string;
  size?: string;
  sku?: string;
  stock?: number;
  minStock?: number;
  averageCost?: number;
  salePrice?: number;
  cashPrice?: number;
  cardPrice?: number;
  active?: boolean;
  imageKey?: string | null;
}

interface ProductPayload {
  name?: string;
  category?: string;
  collection?: string;
  status?: 'Ativo' | 'Arquivado';
  imageKey?: string | null;
  variants?: VariantInput[];
}

export async function createProduct(request: Request, env: Env) {
  const input = await readJson<ProductPayload>(request);
  const name = String(input.name || '').trim();
  if (!name) return fail('Nome do produto é obrigatório.');

  const productId = makeId('prd');
  const timestamp = now();
  const variants = Array.isArray(input.variants) ? input.variants : [];
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`INSERT INTO products(id,name,category,collection,status,image_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(
      productId,name,String(input.category || 'Sem categoria').trim() || 'Sem categoria',nullable(input.collection),input.status === 'Arquivado' ? 'Arquivado' : 'Ativo',nullable(input.imageKey),timestamp,timestamp,
    ),
  ];

  for (const variant of variants) {
    const variantId = makeId('var');
    const stock = integer(variant.stock);
    const cost = Math.max(0, number(variant.averageCost));
    const sale=Math.max(0,number(variant.salePrice));
    const cash=Math.max(0,number(variant.cashPrice,sale));
    const card=Math.max(0,number(variant.cardPrice,cash));
    statements.push(env.DB.prepare(`INSERT INTO product_variants(id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,active,image_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      variantId,productId,nullable(variant.color),nullable(variant.size),nullable(variant.sku),stock,integer(variant.minStock, 1),cost,cash,cash,card,variant.active === false ? 0 : 1,nullable(variant.imageKey),timestamp,timestamp,
    ));
    if (stock > 0) statements.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(makeId('mov'),productId,variantId,'Ajuste',stock,cost,'Estoque inicial',timestamp));
  }

  await env.DB.batch(statements);
  return json({ id: productId }, 201);
}

export async function updateProduct(request: Request, env: Env, productId: string) {
  const input = await readJson<ProductPayload>(request);
  const name = String(input.name || '').trim();
  if (!name) return fail('Nome do produto é obrigatório.');

  const current = await env.DB.prepare(`SELECT * FROM product_variants WHERE product_id=?`).bind(productId).all<any>();
  const old = new Map<string, any>((current.results || []).map((variant: any) => [variant.id, variant]));
  const incoming = Array.isArray(input.variants) ? input.variants : [];
  const incomingIds = new Set(incoming.map(v => v.id).filter((id): id is string => !!id));
  for (const variant of old.values()) if (!incomingIds.has(variant.id) && Number(variant.stock) > 0) return fail('Uma variante com estoque não pode ser removida. Zere ou ajuste o estoque antes de desativá-la.', 409);

  const keep = new Set<string>();
  const timestamp = now();
  const statements: D1PreparedStatement[] = [env.DB.prepare(`UPDATE products SET name=?,category=?,collection=?,status=?,image_key=?,updated_at=? WHERE id=?`).bind(name,String(input.category || 'Sem categoria').trim() || 'Sem categoria',nullable(input.collection),input.status === 'Arquivado' ? 'Arquivado' : 'Ativo',nullable(input.imageKey),timestamp,productId)];

  for (const variant of incoming) {
    if (variant.id && old.has(variant.id)) {
      keep.add(variant.id);
      const previous = old.get(variant.id)!;
      const stock = integer(variant.stock);
      const cost = Math.max(0, number(variant.averageCost));
      const nextSale=Math.max(0,number(variant.salePrice,number(previous.sale_price)));
      const priceChanged=Math.abs(nextSale-number(previous.sale_price))>0.0001;
      const cash=variant.cashPrice!==undefined?Math.max(0,number(variant.cashPrice)):priceChanged?nextSale:Math.max(0,number(previous.cash_price,nextSale));
      const card=variant.cardPrice!==undefined?Math.max(0,number(variant.cardPrice)):priceChanged?nextSale:Math.max(0,number(previous.card_price,cash));
      statements.push(env.DB.prepare(`UPDATE product_variants SET color=?,size=?,sku=?,stock=?,min_stock=?,average_cost=?,sale_price=?,cash_price=?,card_price=?,active=?,image_key=?,updated_at=? WHERE id=? AND product_id=?`).bind(
        nullable(variant.color),nullable(variant.size),nullable(variant.sku),stock,integer(variant.minStock,1),cost,cash,cash,card,variant.active === false ? 0 : 1,nullable(variant.imageKey),timestamp,variant.id,productId,
      ));
      const delta = stock - number(previous.stock);
      if (delta !== 0) statements.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(makeId('mov'),productId,variant.id,'Ajuste',delta,cost,'Edição do produto',timestamp));
    } else {
      const variantId = makeId('var');
      const stock = integer(variant.stock);
      const cost = Math.max(0, number(variant.averageCost));
      const sale=Math.max(0,number(variant.salePrice));
      const cash=Math.max(0,number(variant.cashPrice,sale));
      const card=Math.max(0,number(variant.cardPrice,cash));
      statements.push(env.DB.prepare(`INSERT INTO product_variants(id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,active,image_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        variantId,productId,nullable(variant.color),nullable(variant.size),nullable(variant.sku),stock,integer(variant.minStock,1),cost,cash,cash,card,variant.active === false ? 0 : 1,nullable(variant.imageKey),timestamp,timestamp,
      ));
      if (stock > 0) statements.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(makeId('mov'),productId,variantId,'Ajuste',stock,cost,'Nova variante',timestamp));
    }
  }

  for (const variant of old.values()) if (!keep.has(variant.id)) statements.push(env.DB.prepare(`UPDATE product_variants SET active=0,updated_at=? WHERE id=?`).bind(timestamp, variant.id));
  await env.DB.batch(statements);
  return json({ ok: true });
}

export async function duplicateProduct(env: Env, productId: string) {
  const product = await env.DB.prepare(`SELECT * FROM products WHERE id=?`).bind(productId).first<any>();
  if (!product) return fail('Produto não encontrado.', 404);
  const variants = await env.DB.prepare(`SELECT * FROM product_variants WHERE product_id=? AND active=1`).bind(productId).all<any>();
  const newProductId = makeId('prd');
  const timestamp = now();
  const statements: D1PreparedStatement[] = [env.DB.prepare(`INSERT INTO products(id,name,category,collection,status,image_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(newProductId,`${product.name} — cópia`,product.category,product.collection,'Ativo',product.image_key,timestamp,timestamp)];
  for (const variant of variants.results || []) statements.push(env.DB.prepare(`INSERT INTO product_variants(id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price,cash_price,card_price,active,image_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(makeId('var'),newProductId,variant.color,variant.size,null,0,variant.min_stock,variant.average_cost,variant.cash_price||variant.sale_price,variant.cash_price||variant.sale_price,variant.card_price||variant.cash_price||variant.sale_price,1,variant.image_key,timestamp,timestamp));
  await env.DB.batch(statements);
  return json({ id: newProductId }, 201);
}

export async function archiveProduct(env: Env, productId: string) {
  const stock=await env.DB.prepare(`SELECT COALESCE(SUM(stock),0) total FROM product_variants WHERE product_id=?`).bind(productId).first<any>();
  if(Number(stock?.total||0)>0)return fail('Zere ou ajuste o estoque antes de arquivar este produto.',409);
  const result = await env.DB.prepare(`UPDATE products SET status='Arquivado',updated_at=? WHERE id=?`).bind(now(), productId).run();
  if (!result.meta.changes) return fail('Produto não encontrado.', 404);
  return json({ ok: true });
}

export async function deleteProduct(env:Env,productId:string){
  const product=await env.DB.prepare(`SELECT * FROM products WHERE id=?`).bind(productId).first<any>();
  if(!product)return fail('Produto não encontrado.',404);
  const variants=await env.DB.prepare(`SELECT id,stock,image_key FROM product_variants WHERE product_id=?`).bind(productId).all<any>();
  const stock=(variants.results||[]).reduce((sum:any,v:any)=>sum+Number(v.stock||0),0);
  const refs=await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM sale_items WHERE product_id=?) +
      (SELECT COUNT(*) FROM stock_entries WHERE product_id=?) +
      (SELECT COUNT(*) FROM purchase_items WHERE product_id=?) +
      (SELECT COUNT(*) FROM pricing_history WHERE product_id=?) +
      (SELECT COUNT(*) FROM return_items WHERE product_id=?) +
      (SELECT COUNT(*) FROM inventory_count_items WHERE product_id=?) AS total
  `).bind(productId,productId,productId,productId,productId,productId).first<any>();
  const hasHistory=Number(refs?.total||0)>0;
  if(hasHistory){
    if(stock>0)return fail('Este produto já possui histórico e ainda tem estoque. Ajuste o estoque para zero; depois ele poderá ser retirado da operação sem apagar o histórico.',409);
    await env.DB.prepare(`UPDATE products SET status='Arquivado',updated_at=? WHERE id=?`).bind(now(),productId).run();
    return json({ok:true,mode:'archived'});
  }
  const keys=new Set<string>();if(product.image_key)keys.add(String(product.image_key));for(const v of variants.results||[])if(v.image_key)keys.add(String(v.image_key));
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM inventory_movements WHERE product_id=?`).bind(productId),
    env.DB.prepare(`DELETE FROM product_variants WHERE product_id=?`).bind(productId),
    env.DB.prepare(`DELETE FROM products WHERE id=?`).bind(productId),
  ]);
  await Promise.all([...keys].map(key=>env.MEDIA.delete(key).catch(()=>undefined)));
  return json({ok:true,mode:'deleted'});
}
