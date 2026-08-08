import { now } from '../db';
import { fail, json } from '../http';
import type { Env } from '../types';

export async function receiveReceivable(env:Env,id:string){
  const item=await env.DB.prepare(`SELECT ar.*,s.order_status,s.deleted_at FROM accounts_receivable ar JOIN sales s ON s.id=ar.sale_id WHERE ar.id=?`).bind(id).first<any>();
  if(!item)return fail('Conta a receber não encontrada.',404);
  if(item.deleted_at||item.order_status==='Cancelado')return fail('O pedido desta cobrança não está mais ativo.',409);
  if(item.status==='Cancelado')return fail('Conta cancelada não pode ser recebida.',409);
  if(item.status==='Recebido')return json({ok:true});
  const timestamp=now();
  const statements:D1PreparedStatement[]=[env.DB.prepare(`UPDATE accounts_receivable SET status='Recebido',received_at=?,updated_at=? WHERE id=? AND status='Pendente'`).bind(timestamp,timestamp,id)];
  const remaining=await env.DB.prepare(`SELECT COUNT(*) total FROM accounts_receivable WHERE sale_id=? AND id<>? AND status='Pendente'`).bind(item.sale_id,id).first<any>();
  if(Number(remaining?.total||0)===0)statements.push(env.DB.prepare(`UPDATE sales SET payment_status='Pago',updated_at=? WHERE id=? AND deleted_at IS NULL AND order_status<>'Cancelado'`).bind(timestamp,item.sale_id));
  await env.DB.batch(statements);return json({ok:true});
}

export async function cancelReceivable(env:Env,id:string){
  const item=await env.DB.prepare(`SELECT ar.*,s.order_status,s.deleted_at FROM accounts_receivable ar JOIN sales s ON s.id=ar.sale_id WHERE ar.id=?`).bind(id).first<any>();
  if(!item)return fail('Conta a receber não encontrada.',404);
  if(item.status!=='Pendente')return fail('Somente uma conta pendente pode ser cancelada.',409);
  if(!item.deleted_at&&item.order_status!=='Cancelado')return fail('Não cancele uma cobrança isoladamente. Para manter pedido e financeiro sincronizados, cancele/exclua o pedido ou registre uma troca/devolução.',409);
  await env.DB.prepare(`UPDATE accounts_receivable SET status='Cancelado',updated_at=? WHERE id=? AND status='Pendente'`).bind(now(),id).run();return json({ok:true});
}
