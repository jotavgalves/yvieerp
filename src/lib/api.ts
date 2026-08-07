export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new ApiError(payload.error || 'Não foi possível concluir a operação.', response.status);
  return payload as T;
}
