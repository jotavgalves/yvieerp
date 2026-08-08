export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const headers = new Headers(init?.headers ?? {});
  if (!isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers,
  });

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    const message = payload.error || 'Não foi possível concluir a operação.';
    if (typeof window !== 'undefined' && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new CustomEvent('yvie:toast', { detail: { message, tone: 'error' } }));
      if (response.status === 401) window.dispatchEvent(new Event('yvie:unauthorized'));
    }
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export function notify(message: string, tone: 'success' | 'error' = 'success') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('yvie:toast', { detail: { message, tone } }));
}
