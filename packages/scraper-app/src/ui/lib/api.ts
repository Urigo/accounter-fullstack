import type { BankAccount, Settings } from '../../server/vault.js';

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

// ── Sources ───────────────────────────────────────────────────────────────────

export function getSources<T>(): Promise<T[]> {
  return apiFetch('/api/vault/sources');
}

export function createSource<T>(data: unknown): Promise<T[]> {
  return apiFetch('/api/vault/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateSource<T>(id: string, data: unknown): Promise<T[]> {
  return apiFetch(`/api/vault/sources/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteSource<T>(id: string): Promise<T[]> {
  return apiFetch(`/api/vault/sources/${id}`, { method: 'DELETE' });
}

export function loadSettings(): Promise<Settings> {
  return apiFetch('/api/vault/settings');
}

export function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return apiFetch('/api/vault/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function fetchAccounts(): Promise<BankAccount[]> {
  return apiFetch('/api/vault/accounts');
}

export function updateStatus(id: string, status: 'accepted' | 'ignored'): Promise<BankAccount[]> {
  return apiFetch(`/api/vault/accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}
