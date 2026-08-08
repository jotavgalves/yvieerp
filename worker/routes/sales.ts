import { integer, makeId, now, nullable, number } from '../db';
import { createSaleNumber, fail, json, readJson } from '../http';
import type { Env } from '../types';

type SaleInput = {
  customerId?: string;
  discount?: number;
  creditUsed?: number;
  paymentMethod?: string;
  paymentStatus?: 'Pago' | 'Pendente';
  orderStatus?: 'Separando' | 'Pronto' | 'Entregue';
  dueDate?: string;
  deliveryMethod?: string;
  deliveryAddress?: string;
  promisedDate?: string;
  orderNotes?: string;
  items?: Array<{ productId?: string; variantId?: string; quantity?: number; unitPrice?: number }>;
};

type OrderDetailsInput={deliveryMethod?:string;deliveryAddress?:string;promisedDate?:string;orderNotes?:string};
const isCardMethod=(method:string)=>['Débito','Crédito'].includes(method);

async function creditBalance(env:Env,customerId:string){
  const row=await env.DB.prepare(`SELECT COALESCE(SUM(amount),0) balance FROM customer_credit_movements WHERE customer_id=?`).bind(customerId).first<any>();
  return Math.max(0,Number(row?.balance||0));
}

async function lifecycleStock(env:Env,saleId:string){
  const rows=await env.DB.prepare(`
    SELECT m.product_id,m.variant_id,SUM(m.quantity) AS net_quantity,v.stock,v.average_cost
    FROM inventory_movements m
    JOIN product_variants v ON v.id=m.variant_id
    WHERE (m.reference_type='sale' AND m.reference_id=?)
       OR (m.reference_type='return' AND m.reference_id IN (SELECT id FROM returns WHERE sale_id=?))
    GROUP BY m.product_id,m.variant_id,v.stock,v.average_cost
  `).bind(saleId,saleId).all<any>();
  return rows.results||[];
}

async function lifecycleCreditEffect(env:Env,saleId:string){
  const row=await env.DB.prepare(`
    SELECT COALESCE(SUM(amount),0) total
    FROM customer_credit_movements
    WHERE sale_id=? OR return_id IN (SELECT id FROM returns WHERE sale_id=?)
  `).bind(saleId,saleId).first<any>();
  return Number(row?.total||0);
}

async function buildLifecycleReversal(env:Env,sale:any,kind:'cancel'|'delete',timestamp:string){
  const rows=await lifecycleStock(env,sale.id);const statements:D1PreparedStatement[]=[];
  for(const row of rows){
    const delta=-Number(row.net_quantity||0);const next=Number(row.stock)+delta;
    if(next<0)return {error:fail('Não é possível desfazer este pedido porque algumas peças que precisariam sair do estoque já não estão disponíveis. Faça uma conferência de estoque antes.',409),statements:[]};
    if(delta!==0){
      statements.push(env.DB.prepare(`UPDATE product_variants SET stock=stock+?,updated_at=? WHERE id=?`).bind(delta,timestamp,row.variant_id));
      statements.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(makeId('mov'),row.product_id,row.variant_id,'Cancelamento',delta,row.average_cost,kind==='delete'?'sale_delete':'sale',sale.id,`${kind==='delete'?'Exclusão':'Cancelamento'} ${sale.number}`,timestamp));
    }
  }
  const creditEffect=await lifecycleCreditEffect(env,sale.id);
  if(Math.abs(creditEffect)>0.00001){statements.push(env.DB.prepare(`INSERT INTO customer_credit_movements(id,customer_id,sale_id,type,amount,note,created_at) VALUES(?,?,?,?,?,?,?)`).bind(makeId('ccm'),sale.customer_id,sale.id,'Estorno',-creditEffect,`${kind==='delete'?'Exclusão':'Cancelamento'} ${sale.number}`,timestamp));}
  return {error:null,statements};
}

export async function createSale(request: Request, env: Env) {
  const input = await readJson<SaleInput>(request);
  const items = Array.isArray(input.items) ? input.items : [];
  if (!input.customerId || !items.length) return fail('Cliente e itens são obrigatórios.');
  const customerId=String(input.customerId);
  const customer = await env.DB.prepare('SELECT id FROM customers WHERE id=?').bind(customerId).first();
  if (!customer) return fail('Cliente não encontrado.', 404);
  const paymentMethod=String(input.paymentMethod || 'Pix').trim() || 'Pix';

  const loaded: any[] = [];
  for (const item of items) {
    const variant = await env.DB.prepare(`SELECT v.*,p.name AS product_name,p.status AS product_status FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.product_id=?`).bind(String(item.variantId || ''), String(item.productId || '')).first<any>();
    if (!variant || !variant.active || variant.product_status !== 'Ativo') return fail('Um dos produtos não está disponível.', 409);
    const quantity = integer(item.quantity);
    if (quantity < 1 || Number(variant.stock) < quantity) return fail(`Estoque insuficiente para ${variant.product_name}.`, 409);
    const cashPrice=Math.max(0,number(variant.cash_price,number(variant.sale_price)));
    const cardPrice=Math.max(0,number(variant.card_price,cashPrice));
    const automaticPrice=isCardMethod(paymentMethod)?cardPrice:cashPrice;
    loaded.push({ productId: variant.product_id, variantId: variant.id, quantity, unitPrice: Math.max(0, number(item.unitPrice, automaticPrice)), unitCost: number(variant.average_cost) });
  }

  const subtotal = loaded.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = Math.min(Math.max(0, number(input.discount)), subtotal);
  const total = subtotal - discount;
  const availableCredit=await creditBalance(env,customerId);
  const requestedCredit=Math.max(0,number(input.creditUsed));
  const creditUsed=Math.min(requestedCredit,availableCredit,total);
  if(requestedCredit-creditUsed>0.009)return fail('O crédito informado é maior que o saldo disponível da cliente ou que o valor do pedido.',409);
  const amountDue=Math.max(0,total-creditUsed);
  const costTotal = loaded.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const saleId = makeId('sal');
  const timestamp = now();
  const saleNumber = createSaleNumber();
  const orderStatus = ['Separando','Pronto','Entregue'].includes(String(input.orderStatus)) ? input.orderStatus! : 'Separando';
  const requestedPaymentStatus = input.paymentStatus === 'Pendente' ? 'Pendente' : 'Pago';
  const paymentStatus=amountDue<=0?'Pago':requestedPaymentStatus;
  const deliveredAt=orderStatus==='Entregue'?timestamp:null;
  const statements: D1PreparedStatement[] = [env.DB.prepare(`INSERT INTO sales(id,number,customer_id,order_status,payment_status,payment_method,subtotal,discount,credit_used,total,cost_total,profit,created_at,updated_at,delivered_at,delivery_method,delivery_address,promised_date,order_notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(saleId,saleNumber,customerId,orderStatus,paymentStatus,paymentMethod,subtotal,discount,creditUsed,total,costTotal,total-costTotal,timestamp,timestamp,deliveredAt,nullable(input.deliveryMethod),nullable(input.deliveryAddress),nullable(input.promisedDate),nullable(input.orderNotes))];
  for (const item of loaded) {
    statements.push(env.DB.prepare('UPDATE product_variants SET stock=stock-?,updated_at=? WHERE id=?').bind(item.quantity,timestamp,item.variantId));
    statements.push(env.DB.prepare('INSERT INTO sale_items(id,sale_id,product_id,variant_id,quantity,unit_price,unit_cost) VALUES(?,?,?,?,?,?,?)').bind(makeId('sai'),saleId,item.productId,item.variantId,item.quantity,item.unitPrice,item.unitCost));
    statements.push(env.DB.prepare('INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(makeId('mov'),item.productId,item.variantId,'Venda',-item.quantity,item.unitCost,'sale',saleId,saleNumber,timestamp));
  }
  if(creditUsed>0)statements.push(env.DB.prepare(`INSERT INTO customer_credit_movements(id,customer_id,sale_id,type,amount,note,created_at) VALUES(?,?,?,?,?,?,?)`).bind(makeId('ccm'),customerId,saleId,'Uso',-creditUsed,`Crédito usado em ${saleNumber}`,timestamp));
  if(paymentStatus==='Pendente'&&amountDue>0){statements.push(env.DB.prepare(`INSERT INTO accounts_receivable(id,sale_id,description,amount,due_date,status,created_at,updated_at) VALUES(?,?,?,?,?,'Pendente',?,?)`).bind(makeId('rec'),saleId,`Saldo de ${saleNumber}`,amountDue,typeof input.dueDate==='string'&&input.dueDate?input.dueDate:timestamp.slice(0,10),timestamp,timestamp));}
  await env.DB.batch(statements);
  return json({ id: saleId, number: saleNumber, creditUsed, amountDue }, 201);
}

export async function updateOrderStatus(request: Request, env: Env, saleId: string) {
  const input = await readJson<{ orderStatus?: string }>(request);
  if (!['Separando','Pronto','Entregue'].includes(String(input.orderStatus))) return fail('Status inválido.');
  const timestamp=now();const deliveredAt=input.orderStatus==='Entregue'?timestamp:null;
  const result = await env.DB.prepare("UPDATE sales SET order_status=?,delivered_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL AND order_status<>'Cancelado'").bind(input.orderStatus,deliveredAt,timestamp,saleId).run();
  if (!result.meta.changes) {
    const sale = await env.DB.prepare('SELECT order_status,deleted_at FROM sales WHERE id=?').bind(saleId).first<any>();
    if (!sale||sale.deleted_at) return fail('Pedido não encontrado.', 404);
    if (sale.order_status === 'Cancelado') return fail('Um pedido cancelado não pode voltar ao fluxo operacional.', 409);
  }
  return json({ ok: true });
}

export async function updateOrderDetails(request:Request,env:Env,saleId:string){
  const input=await readJson<OrderDetailsInput>(request);const timestamp=now();
  const result=await env.DB.prepare(`UPDATE sales SET delivery_method=?,delivery_address=?,promised_date=?,order_notes=?,updated_at=? WHERE id=? AND deleted_at IS NULL`).bind(nullable(input.deliveryMethod),nullable(input.deliveryAddress),nullable(input.promisedDate),nullable(input.orderNotes),timestamp,saleId).run();
  if(!result.meta.changes)return fail('Pedido não encontrado.',404);return json({ok:true});
}

export async function cancelSale(env: Env, saleId: string) {
  const sale = await env.DB.prepare('SELECT * FROM sales WHERE id=? AND deleted_at IS NULL').bind(saleId).first<any>();
  if (!sale) return fail('Venda não encontrada.', 404);
  if (sale.order_status === 'Cancelado') return json({ ok: true });
  const timestamp = now();const reversal=await buildLifecycleReversal(env,sale,'cancel',timestamp);if(reversal.error)return reversal.error;
  const statements:D1PreparedStatement[]=[...reversal.statements,env.DB.prepare("UPDATE sales SET order_status='Cancelado',delivered_at=NULL,updated_at=? WHERE id=?").bind(timestamp,saleId),env.DB.prepare("UPDATE accounts_receivable SET status='Cancelado',updated_at=? WHERE sale_id=? AND status='Pendente'").bind(timestamp,saleId)];
  await env.DB.batch(statements);return json({ ok: true });
}

export async function deleteSale(env:Env,saleId:string){
  const sale=await env.DB.prepare(`SELECT * FROM sales WHERE id=? AND deleted_at IS NULL`).bind(saleId).first<any>();
  if(!sale)return fail('Pedido não encontrado.',404);
  const timestamp=now();const reversal=await buildLifecycleReversal(env,sale,'delete',timestamp);if(reversal.error)return reversal.error;
  const statements:D1PreparedStatement[]=[...reversal.statements,env.DB.prepare(`UPDATE accounts_receivable SET status='Cancelado',updated_at=? WHERE sale_id=? AND status='Pendente'`).bind(timestamp,saleId),env.DB.prepare(`UPDATE sales SET deleted_at=?,updated_at=? WHERE id=?`).bind(timestamp,timestamp,saleId)];
  await env.DB.batch(statements);return new Response(null,{status:204});
}
