import { fail, json } from '../http';
import type { Env } from '../types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);

export async function uploadMedia(request: Request, env: Env) {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return fail('Selecione uma imagem para enviar.');
  const ext = allowedTypes.get(file.type);
  if (!ext) return fail('Formato não suportado. Use JPG, PNG, WEBP ou AVIF.', 415);
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return fail('A imagem deve ter no máximo 5 MB.', 413);

  const key = `img_${crypto.randomUUID().replace(/-/g, '')}.${ext}`;
  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'private, max-age=86400',
    },
    customMetadata: { originalName: file.name.slice(0, 160) },
  });
  return json({ key, url: `/media/${key}` }, 201);
}

export async function getMedia(env: Env, key: string) {
  if (!/^img_[a-f0-9]+\.(jpg|png|webp|avif)$/i.test(key)) return fail('Imagem inválida.', 400);
  const object = await env.MEDIA.get(key);
  if (!object) return fail('Imagem não encontrada.', 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=86400');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}

export async function deleteMedia(env: Env, key: string) {
  if (!/^img_[a-f0-9]+\.(jpg|png|webp|avif)$/i.test(key)) return fail('Imagem inválida.', 400);
  await env.MEDIA.delete(key);
  return json({ ok: true });
}
