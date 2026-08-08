import { now } from '../db';
import { fail, json } from '../http';
import type { Env } from '../types';

export async function receiveReceivable(env:Env,id:string){
  const item=await env.DB.prepare(`SELECT * FROM accounts_receivable WHERE id=?`).bind(id).first<any>();
  if(!item)return fail('Conta a receber não encontrada.',404);
  if(item.status==='Cancelado')return fail('Conta cancelada não pode ser recebida.',409);
  const timestamp=now();
  const statements:D1PreparedStatement[]=[env.DB.prepare(`UPDATE accounts_receivable SET status='Recebido',received_at=?,updated_at=? WHERE id=?`).bind(timestamp,timestamp,id)];
  const remaining=await env.DB.prepare(`SELECT COUNT(*) total FROM accounts_receivable WHERE sale_id=? AND id<>? AND status='Pendente'`).bind(item.sale_id,id).first<any>();
  if(Number(remaining?.total||0)===0)statements.push(env.DB.prepare(`UPDATE sales SET payment_status='Pago',updated_at=? WHERE id=?`).bind(timestamp,item.sale_id));
  await env.DB.batch(statements);
  return json({ok:true});
}

export async function cancelReceivable(env:Env,id:string){
  const result=await env.DB.prepare(`UPDATE accounts_receivable SET status='Cancelado',updated_at=? WHERE id=? AND status='Pendente'`).bind(now(),id).run();
  if(!result.meta.changes)return fail('Conta pendente não encontrada.',404);
  return json({ok:true});
}
