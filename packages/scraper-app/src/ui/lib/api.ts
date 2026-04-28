export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function vaultStatus(): Promise<{ locked: boolean; hasFile: boolean }> {
  return apiFetch('/api/vault/status');
}

export function vaultUnlock(password: string): Promise<{ ok: boolean }> {
  return apiFetch('/api/vault/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export function vaultCreate(
  password: string,
  serverUrl: string,
  apiKey: string,
): Promise<{ ok: boolean }> {
  return apiFetch('/api/vault/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, serverUrl, apiKey }),
  });
}
