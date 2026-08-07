import { makeId, now, nullable, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

interface ExpensePayload {
  description?: string;
  category?: string;
  amount?: number;
  expenseDate?: string;
  recurring?: boolean;
  notes?: string;
}

export async function createExpense(request: Request, env: Env) {
  const input = await readJson<ExpensePayload>(request);
  const description = String(input.description || '').trim();
  const amount = number(input.amount);
  if (!description || amount <= 0) return fail('Descrição e valor são obrigatórios.');
  const id = makeId('exp');
  await env.DB.prepare(`
    INSERT INTO expenses(id,description,category,amount,expense_date,recurring,notes,created_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    id,
    description,
    String(input.category || 'Outros').trim() || 'Outros',
    amount,
    String(input.expenseDate || new Date().toISOString().slice(0, 10)),
    input.recurring ? 1 : 0,
    nullable(input.notes),
    now(),
  ).run();
  return json({ id }, 201);
}

export async function deleteExpense(env: Env, id: string) {
  const result = await env.DB.prepare(`DELETE FROM expenses WHERE id=?`).bind(id).run();
  if (!result.meta.changes) return fail('Despesa não encontrada.', 404);
  return new Response(null, { status: 204 });
}
