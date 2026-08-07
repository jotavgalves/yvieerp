import { integer, makeId, now, number } from '../db';
import { createSaleNumber, fail, json, readJson } from '../http';
import type { Env } from '../types';

type SaleInput = {
  customerId?: string;
  discount?: number;
  paymentMethod?: string;
  paymentStatus?: 'Pago' | 'Pendente';
  orderStatus?: 'Separando' | 'Pronto' | 'Entregue';
  items?: Array<{ productId?: string; variantId?: string; quantity?: number; unitPrice?: number }>;
};

export async function createSale(request: Request, env: Env) {
  const input = await readJson<SaleInput>(request);
  const items = Array.isArray(input.items) ? input.items : [];
  if (!input.customerId || !items.length) return fail('Cliente e itens são obrigatórios.');
  const customer = await env.DB.prepare('SELECT id FROM customers WHERE id=?').bind(String(input.customerId)).first();
  if (!customer) return fail('Cliente não encontrado.', 404);

  const loaded: any[] = [];
  for (const item of items) {
    const variant = await env.DB.prepare(`SELECT v.*,p.name AS product_name,p.status AS product_status FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.product_id=?`).bind(String(item.variantId || ''), String(item.productId || '')).first<any>();
    if (!variant || !variant.active || variant.product_status !== 'Ativo') return fail('Um dos produtos não está disponível.', 409);
    const quantity = integer(item.quantity);
    if (quantity < 1 || Number(variant.stock) < quantity) return fail(`Estoque insuficiente para ${variant.product_name}.`, 409);
    loaded.push({ productId: variant.product_id, variantId: variant.id, quantity, unitPrice: Math.max(0, number(item.unitPrice, variant.sale_price)), unitCost: number(variant.average_cost) });
  }

  const subtotal = loaded.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = Math.min(Math.max(0, number(input.discount)), subtotal);
  const total = subtotal - discount;
  const costTotal = loaded.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const saleId = makeId('sal');
  const timestamp = now();
  const saleNumber = createSaleNumber();
  const orderStatus = ['Separando','Pronto','Entregue'].includes(String(input.orderStatus)) ? input.orderStatus! : 'Separando';
  const paymentStatus = input.paymentStatus === 'Pendente' ? 'Pendente' : 'Pago';
  const statements: D1PreparedStatement[] = [env.DB.prepare(`INSERT INTO sales(id,number,customer_id,order_status,payment_status,payment_method,subtotal,discount,total,cost_total,profit,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(saleId,saleNumber,String(input.customerId),orderStatus,paymentStatus,String(input.paymentMethod || 'Pix').trim() || 'Pix',subtotal,discount,total,costTotal,total-costTotal,timestamp,timestamp)];
  for (const item of loaded) {
    statements.push(env.DB.prepare('UPDATE product_variants SET stock=stock-?,updated_at=? WHERE id=?').bind(item.quantity,timestamp,item.variantId));
    statements.push(env.DB.prepare('INSERT INTO sale_items(id,sale_id,product_id,variant_id,quantity,unit_price,unit_cost) VALUES(?,?,?,?,?,?,?)').bind(makeId('sai'),saleId,item.productId,item.variantId,item.quantity,item.unitPrice,item.unitCost));
    statements.push(env.DB.prepare('INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(makeId('mov'),item.productId,item.variantId,'Venda',-item.quantity,item.unitCost,'sale',saleId,saleNumber,timestamp));
  }
  await env.DB.batch(statements);
  return json({ id: saleId, number: saleNumber }, 201);
}

export async function updateOrderStatus(request: Request, env: Env, saleId: string) {
  const input = await readJson<{ orderStatus?: string }>(request);
  if (!['Separando','Pronto','Entregue'].includes(String(input.orderStatus))) return fail('Status inválido.');
  const result = await env.DB.prepare("UPDATE sales SET order_status=?,updated_at=? WHERE id=? AND order_status<>'Cancelado'").bind(input.orderStatus,now(),saleId).run();
  if (!result.meta.changes) {
    const sale = await env.DB.prepare('SELECT order_status FROM sales WHERE id=?').bind(saleId).first<{ order_status: string }>();
    if (!sale) return fail('Venda não encontrada.', 404);
    if (sale.order_status === 'Cancelado') return fail('Uma venda cancelada não pode voltar ao fluxo operacional.', 409);
  }
  return json({ ok: true });
}

export async function cancelSale(env: Env, saleId: string) {
  const sale = await env.DB.prepare('SELECT * FROM sales WHERE id=?').bind(saleId).first<any>();
  if (!sale) return fail('Venda não encontrada.', 404);
  if (sale.order_status === 'Cancelado') return json({ ok: true });
  const items = await env.DB.prepare('SELECT * FROM sale_items WHERE sale_id=?').bind(saleId).all<any>();
  const timestamp = now();
  const statements: D1PreparedStatement[] = [env.DB.prepare("UPDATE sales SET order_status='Cancelado',updated_at=? WHERE id=?").bind(timestamp,saleId)];
  for (const item of items.results || []) {
    statements.push(env.DB.prepare('UPDATE product_variants SET stock=stock+?,updated_at=? WHERE id=?').bind(item.quantity,timestamp,item.variant_id));
    statements.push(env.DB.prepare('INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(makeId('mov'),item.product_id,item.variant_id,'Cancelamento',item.quantity,item.unit_cost,'sale',saleId,`Cancelamento ${sale.number}`,timestamp));
  }
  await env.DB.batch(statements);
  return json({ ok: true });
}
