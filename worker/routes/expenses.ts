import { makeId, now, nullable, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

interface ExpensePayload {
  description?: string;
  category?: string;
  amount?: number;
  expenseDate?: string;
  recurring?: boolean;
  status?: 'Pago'|'Pendente';
  dueDate?: string;
  beneficiary?: string;
  notes?: string;
}

function normalize(input:ExpensePayload){
  const description=String(input.description||'').trim();
  const amount=number(input.amount);
  const status=input.status==='Pendente'?'Pendente':'Pago';
  return {description,amount,status,category:String(input.category||'Outros').trim()||'Outros',expenseDate:String(input.expenseDate||new Date().toISOString().slice(0,10)),recurring:input.recurring?1:0,dueDate:nullable(input.dueDate),beneficiary:nullable(input.beneficiary),notes:nullable(input.notes)};
}

export async function createExpense(request: Request, env: Env) {
  const input=normalize(await readJson<ExpensePayload>(request));
  if(!input.description||input.amount<=0)return fail('Descrição e valor são obrigatórios.');
  const id=makeId('exp');const timestamp=now();
  await env.DB.prepare(`INSERT INTO expenses(id,description,category,amount,expense_date,recurring,status,due_date,paid_at,beneficiary,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,input.description,input.category,input.amount,input.expenseDate,input.recurring,input.status,input.dueDate,input.status==='Pago'?timestamp:null,input.beneficiary,input.notes,timestamp).run();
  return json({id},201);
}

export async function updateExpense(request:Request,env:Env,id:string){
  const input=normalize(await readJson<ExpensePayload>(request));
  if(!input.description||input.amount<=0)return fail('Descrição e valor são obrigatórios.');
  const current=await env.DB.prepare('SELECT id,status,paid_at FROM expenses WHERE id=?').bind(id).first<any>();
  if(!current)return fail('Despesa não encontrada.',404);
  const paidAt=input.status==='Pago'?(current.paid_at||now()):null;
  await env.DB.prepare(`UPDATE expenses SET description=?,category=?,amount=?,expense_date=?,recurring=?,status=?,due_date=?,paid_at=?,beneficiary=?,notes=? WHERE id=?`).bind(input.description,input.category,input.amount,input.expenseDate,input.recurring,input.status,input.dueDate,paidAt,input.beneficiary,input.notes,id).run();
  return json({ok:true});
}

export async function markExpensePaid(env:Env,id:string){
  const result=await env.DB.prepare(`UPDATE expenses SET status='Pago',paid_at=? WHERE id=?`).bind(now(),id).run();
  if(!result.meta.changes)return fail('Despesa não encontrada.',404);
  return json({ok:true});
}

export async function deleteExpense(env: Env, id: string) {
  const result = await env.DB.prepare(`DELETE FROM expenses WHERE id=?`).bind(id).run();
  if (!result.meta.changes) return fail('Despesa não encontrada.', 404);
  return new Response(null, { status: 204 });
}
