import { clearSessionCookie, createSession, passwordMatches, sessionCookie, verifySession } from './auth';
import { bootstrap } from './db';
import { fail, json, readJson, sameOrigin } from './http';
import { createCustomer, deleteCustomer, updateCustomer } from './routes/customers';
import { createExpense, deleteExpense } from './routes/expenses';
import { adjustStock, createStockEntry } from './routes/inventory';
import { archiveProduct, createProduct, duplicateProduct, updateProduct } from './routes/products';
import { cancelSale, createSale, updateOrderStatus } from './routes/sales';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return new Response(null, { status: 404 });

    try {
      if (url.pathname === '/api/auth/session' && request.method === 'GET') {
        return json({ authenticated: await verifySession(request, env) });
      }

      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        if (!sameOrigin(request)) return fail('Origem da requisição não autorizada.', 403);
        const input = await readJson<{ password?: string }>(request);
        if (!input.password || !(await passwordMatches(input.password, env))) return fail('Senha de acesso inválida.', 401);
        const token = await createSession(env);
        return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, request) });
      }

      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        if (!sameOrigin(request)) return fail('Origem da requisição não autorizada.', 403);
        return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
      }

      if (!(await verifySession(request, env))) return fail('Sessão expirada. Entre novamente.', 401);
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !sameOrigin(request)) {
        return fail('Origem da requisição não autorizada.', 403);
      }

      if (url.pathname === '/api/bootstrap' && request.method === 'GET') return json(await bootstrap(env));

      if (url.pathname === '/api/customers' && request.method === 'POST') return createCustomer(request, env);
      const customer = url.pathname.match(/^\/api\/customers\/([^/]+)$/);
      if (customer && request.method === 'PUT') return updateCustomer(request, env, customer[1]);
      if (customer && request.method === 'DELETE') return deleteCustomer(env, customer[1]);

      if (url.pathname === '/api/products' && request.method === 'POST') return createProduct(request, env);
      const product = url.pathname.match(/^\/api\/products\/([^/]+)$/);
      if (product && request.method === 'PUT') return updateProduct(request, env, product[1]);
      const duplicate = url.pathname.match(/^\/api\/products\/([^/]+)\/duplicate$/);
      if (duplicate && request.method === 'POST') return duplicateProduct(env, duplicate[1]);
      const archive = url.pathname.match(/^\/api\/products\/([^/]+)\/archive$/);
      if (archive && request.method === 'POST') return archiveProduct(env, archive[1]);

      const adjustment = url.pathname.match(/^\/api\/inventory\/([^/]+)\/adjust$/);
      if (adjustment && request.method === 'POST') return adjustStock(request, env, adjustment[1]);
      if (url.pathname === '/api/inventory/entries' && request.method === 'POST') return createStockEntry(request, env);

      if (url.pathname === '/api/sales' && request.method === 'POST') return createSale(request, env);
      const status = url.pathname.match(/^\/api\/sales\/([^/]+)\/status$/);
      if (status && request.method === 'PATCH') return updateOrderStatus(request, env, status[1]);
      const cancellation = url.pathname.match(/^\/api\/sales\/([^/]+)\/cancel$/);
      if (cancellation && request.method === 'POST') return cancelSale(env, cancellation[1]);

      if (url.pathname === '/api/expenses' && request.method === 'POST') return createExpense(request, env);
      const expense = url.pathname.match(/^\/api\/expenses\/([^/]+)$/);
      if (expense && request.method === 'DELETE') return deleteExpense(env, expense[1]);

      return fail('Rota não encontrada.', 404);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : '';
      if (message === 'JSON_INVALID') return fail('Corpo da requisição inválido.', 400);
      if (message.includes('CHECK constraint failed')) return fail('A operação deixaria o estoque em um estado inválido. Atualize os dados e tente novamente.', 409);
      if (message.includes('UNIQUE constraint failed')) return fail('Já existe um registro com este SKU ou identificador.', 409);
      return fail('Não foi possível concluir a operação.', 500);
    }
  },
} satisfies ExportedHandler<Env>;
