import { integer, makeId, now, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

type ReturnPayload={
  type?:'Devolução'|'Troca';
  returnedItems?:Array<{saleItemId?:string;quantity?:number}>;
  exchangeItems?:Array<{productId?:string;variantId?:string;quantity?:number;unitPrice?:number}>;
  refundAmount?:number;
  creditAmount?:number;
  notes?:string;
};

export async function createReturn(request:Request,env:Env,saleId:string){
  const input=await readJson<ReturnPayload>(request);
  const sale=await env.DB.prepare(`SELECT * FROM sales WHERE id=? AND deleted_at IS NULL`).bind(saleId).first<any>();
  if(!sale)return fail('Venda não encontrada.',404);
  if(sale.order_status==='Cancelado')return fail('Não é possível devolver itens de uma venda cancelada.',409);
  const returned=Array.isArray(input.returnedItems)?input.returnedItems:[];
  const exchange=Array.isArray(input.exchangeItems)?input.exchangeItems:[];
  if(!returned.length)return fail('Selecione ao menos um item que está retornando.');

  const returnId=makeId('ret');const timestamp=now();const numberCode=`TR-${Date.now().toString().slice(-8)}`;
  const statements:D1PreparedStatement[]=[];
  let returnedValue=0;

  for(const raw of returned){
    const item=await env.DB.prepare(`SELECT si.*,p.name AS product_name FROM sale_items si JOIN products p ON p.id=si.product_id WHERE si.id=? AND si.sale_id=?`).bind(String(raw.saleItemId||''),saleId).first<any>();
    if(!item)return fail('Um dos itens não pertence a essa venda.',409);
    const quantity=integer(raw.quantity);
    if(quantity<1)return fail('Quantidade devolvida inválida.');
    const already=await env.DB.prepare(`SELECT COALESCE(SUM(ri.quantity),0) total FROM return_items ri JOIN returns r ON r.id=ri.return_id WHERE r.sale_id=? AND ri.sale_item_id=? AND ri.direction='Entrada'`).bind(saleId,item.id).first<any>();
    if(quantity+Number(already?.total||0)>Number(item.quantity))return fail(`A quantidade devolvida de ${item.product_name} ultrapassa o que foi vendido.`,409);
    returnedValue+=quantity*Number(item.unit_price);
    statements.push(env.DB.prepare(`UPDATE product_variants SET stock=stock+?,updated_at=? WHERE id=?`).bind(quantity,timestamp,item.variant_id));
    statements.push(env.DB.prepare(`INSERT INTO return_items(id,return_id,sale_item_id,product_id,variant_id,quantity,direction,unit_cost,unit_price) VALUES(?,?,?,?,?,?,?,?,?)`).bind(makeId('rti'),returnId,item.id,item.product_id,item.variant_id,quantity,'Entrada',item.unit_cost,item.unit_price));
    statements.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(makeId('mov'),item.product_id,item.variant_id,'Devolução',quantity,item.unit_cost,'return',returnId,`${input.type==='Troca'?'Troca':'Devolução'} ${sale.number}`,timestamp));
  }

  let exchangeValue=0;
  for(const raw of exchange){
    const variant=await env.DB.prepare(`SELECT v.*,p.name AS product_name,p.status AS product_status FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.product_id=?`).bind(String(raw.variantId||''),String(raw.productId||'')).first<any>();
    if(!variant||!variant.active||variant.product_status!=='Ativo')return fail('Uma das peças de troca não está disponível.',409);
    const quantity=integer(raw.quantity);
    if(quantity<1||Number(variant.stock)<quantity)return fail(`Estoque insuficiente para ${variant.product_name}.`,409);
    const unitPrice=Math.max(0,number(raw.unitPrice,variant.cash_price||variant.sale_price));exchangeValue+=quantity*unitPrice;
    statements.push(env.DB.prepare(`UPDATE product_variants SET stock=stock-?,updated_at=? WHERE id=?`).bind(quantity,timestamp,variant.id));
    statements.push(env.DB.prepare(`INSERT INTO return_items(id,return_id,sale_item_id,product_id,variant_id,quantity,direction,unit_cost,unit_price) VALUES(?,?,?,?,?,?,?,?,?)`).bind(makeId('rti'),returnId,null,variant.product_id,variant.id,quantity,'Saída',variant.average_cost,unitPrice));
    statements.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(makeId('mov'),variant.product_id,variant.id,'Venda',-quantity,variant.average_cost,'return',returnId,`Saída em troca ${sale.number}`,timestamp));
  }

  const available=Math.max(0,returnedValue-exchangeValue);
  const refund=Math.max(0,number(input.refundAmount,available));
  const credit=Math.max(0,number(input.creditAmount,0));
  if(refund+credit>available+0.009)return fail('Reembolso + crédito não podem ultrapassar o valor líquido que está retornando para a cliente.',409);
  statements.unshift(env.DB.prepare(`INSERT INTO returns(id,number,sale_id,type,refund_amount,credit_amount,notes,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(returnId,numberCode,saleId,input.type==='Troca'?'Troca':'Devolução',refund,credit,typeof input.notes==='string'&&input.notes.trim()?input.notes.trim():null,timestamp));
  if(credit>0)statements.push(env.DB.prepare(`INSERT INTO customer_credit_movements(id,customer_id,sale_id,return_id,type,amount,note,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(makeId('ccm'),sale.customer_id,saleId,returnId,'Crédito',credit,`Crédito gerado por ${numberCode}`,timestamp));
  await env.DB.batch(statements);
  return json({id:returnId,number:numberCode,returnedValue,exchangeValue,refundAmount:refund,creditAmount:credit},201);
}
