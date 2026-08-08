import { makeId, now, nullable } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

interface SupplierPayload {
  name?: string;
  phone?: string;
  instagram?: string;
  email?: string;
  cnpj?: string;
  notes?: string;
  active?: boolean;
}

export async function createSupplier(request: Request, env: Env) {
  const input = await readJson<SupplierPayload>(request);
  const name = String(input.name || '').trim();
  if (!name) return fail('Nome do fornecedor é obrigatório.');
  const id = makeId('sup');
  const timestamp = now();
  await env.DB.prepare(`
    INSERT INTO suppliers(id,name,phone,instagram,email,cnpj,notes,active,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, name, nullable(input.phone), nullable(input.instagram), nullable(input.email), nullable(input.cnpj), nullable(input.notes),
    input.active === false ? 0 : 1, timestamp, timestamp,
  ).run();
  return json({ id }, 201);
}

export async function updateSupplier(request: Request, env: Env, id: string) {
  const input = await readJson<SupplierPayload>(request);
  const name = String(input.name || '').trim();
  if (!name) return fail('Nome do fornecedor é obrigatório.');
  const result = await env.DB.prepare(`
    UPDATE suppliers SET name=?,phone=?,instagram=?,email=?,cnpj=?,notes=?,active=?,updated_at=? WHERE id=?
  `).bind(
    name, nullable(input.phone), nullable(input.instagram), nullable(input.email), nullable(input.cnpj), nullable(input.notes),
    input.active === false ? 0 : 1, now(), id,
  ).run();
  if (!result.meta.changes) return fail('Fornecedor não encontrado.', 404);
  return json({ ok: true });
}

export async function archiveSupplier(env: Env, id: string) {
  const result = await env.DB.prepare(`UPDATE suppliers SET active=0,updated_at=? WHERE id=?`).bind(now(), id).run();
  if (!result.meta.changes) return fail('Fornecedor não encontrado.', 404);
  return json({ ok: true });
}
