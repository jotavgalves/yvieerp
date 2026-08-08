import { makeId, now, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

type Payload={amount?:number;note?:string};

export async function adjustCustomerCredit(request:Request,env:Env,customerId:string){
  const customer=await env.DB.prepare(`SELECT id,name FROM customers WHERE id=?`).bind(customerId).first<any>();
  if(!customer)return fail('Cliente não encontrado.',404);
  const input=await readJson<Payload>(request);const amount=number(input.amount);if(Math.abs(amount)<0.005)return fail('Informe um valor diferente de zero.');
  const current=await env.DB.prepare(`SELECT COALESCE(SUM(amount),0) balance FROM customer_credit_movements WHERE customer_id=?`).bind(customerId).first<any>();
  const balance=Number(current?.balance||0);if(balance+amount<-0.009)return fail('O ajuste deixaria o crédito da cliente negativo.',409);
  const note=String(input.note||'Ajuste manual de crédito').trim()||'Ajuste manual de crédito';const timestamp=now();const id=makeId('ccm');
  await env.DB.prepare(`INSERT INTO customer_credit_movements(id,customer_id,type,amount,note,created_at) VALUES(?,?,?,?,?,?)`).bind(id,customerId,'Ajuste',amount,note,timestamp).run();
  return json({id,balance:balance+amount},201);
}
