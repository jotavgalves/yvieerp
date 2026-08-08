import { makeId, now, nullable, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

type Payload={type?:'Aporte'|'Pró-labore'|'Retirada';amount?:number;transactionDate?:string;notes?:string};

export async function createOwnerTransaction(request:Request,env:Env){
  const input=await readJson<Payload>(request);const type=input.type;const amount=Math.max(0,number(input.amount));
  if(!type||!['Aporte','Pró-labore','Retirada'].includes(type)||amount<=0)return fail('Tipo e valor são obrigatórios.');
  const id=makeId('own'),timestamp=now(),date=String(input.transactionDate||timestamp.slice(0,10));
  await env.DB.prepare(`INSERT INTO owner_transactions(id,type,amount,transaction_date,notes,created_at) VALUES(?,?,?,?,?,?)`).bind(id,type,amount,date,nullable(input.notes),timestamp).run();
  return json({id},201);
}

export async function deleteOwnerTransaction(env:Env,id:string){
  const result=await env.DB.prepare(`DELETE FROM owner_transactions WHERE id=?`).bind(id).run();
  if(!result.meta.changes)return fail('Movimentação não encontrada.',404);
  return new Response(null,{status:204});
}
