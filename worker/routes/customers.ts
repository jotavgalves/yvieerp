import { makeId, now, nullable } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

interface CustomerPayload {
  name?: string;
  phone?: string;
  instagram?: string;
  email?: string;
  city?: string;
  tags?: string[];
  notes?: string;
}

function validate(payload: CustomerPayload) {
  const name = String(payload.name || '').trim();
  const phone = String(payload.phone || '').replace(/\D/g, '');
  if (!name || !phone) return null;
  return {
    name,
    phone,
    instagram: nullable(payload.instagram),
    email: nullable(payload.email),
    city: nullable(payload.city),
    tags: JSON.stringify(Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : []),
    notes: nullable(payload.notes),
  };
}

export async function createCustomer(request: Request, env: Env) {
  const input = validate(await readJson<CustomerPayload>(request));
  if (!input) return fail('Nome e WhatsApp são obrigatórios.');
  const id = makeId('cus');
  await env.DB.prepare(`
    INSERT INTO customers(id,name,phone,instagram,email,city,tags,notes,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)
  `).bind(id, input.name, input.phone, input.instagram, input.email, input.city, input.tags, input.notes, now()).run();
  return json({ id }, 201);
}

export async function updateCustomer(request: Request, env: Env, id: string) {
  const input = validate(await readJson<CustomerPayload>(request));
  if (!input) return fail('Nome e WhatsApp são obrigatórios.');
  const result = await env.DB.prepare(`
    UPDATE customers
    SET name=?,phone=?,instagram=?,email=?,city=?,tags=?,notes=?
    WHERE id=?
  `).bind(input.name, input.phone, input.instagram, input.email, input.city, input.tags, input.notes, id).run();
  if (!result.meta.changes) return fail('Cliente não encontrado.', 404);
  return json({ ok: true });
}

export async function deleteCustomer(env: Env, id: string) {
  const used = await env.DB.prepare(`SELECT COUNT(*) AS n FROM sales WHERE customer_id=?`).bind(id).first<{ n: number }>();
  if ((used?.n || 0) > 0) return fail('Este cliente possui vendas e não pode ser excluído.', 409);
  const result = await env.DB.prepare(`DELETE FROM customers WHERE id=?`).bind(id).run();
  if (!result.meta.changes) return fail('Cliente não encontrado.', 404);
  return new Response(null, { status: 204 });
}
