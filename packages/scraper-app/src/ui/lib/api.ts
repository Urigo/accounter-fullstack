import type { BankAccount, Settings } from '../../server/vault.js';
import type { RunRecord } from '../../shared/types.js';

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

export function deleteAccount(id: string): Promise<BankAccount[]> {
  return apiFetch(`/api/vault/accounts/${id}`, { method: 'DELETE' });
}

// ── Vault path ────────────────────────────────────────────────────────────────

export function getVaultPath(): Promise<{ path: string }> {
  return apiFetch('/api/vault/path');
}

export function getEnvVaultPath(): Promise<{ path: string }> {
  return apiFetch('/api/vault/env-path');
}

export async function vaultUpload(file: File, force = false): Promise<{ ok: boolean }> {
  const url = force ? '/api/vault/upload?force=true' : '/api/vault/upload';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ ok: boolean }>;
}

export async function vaultDownload(suggestedName = '.vault'): Promise<void> {
  const res = await fetch('/api/vault/download');
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Connection test ───────────────────────────────────────────────────────────

export function testConnection(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  return apiFetch('/api/vault/test-connection');
}

// ── History ───────────────────────────────────────────────────────────────────

export function getHistory(): Promise<RunRecord[]> {
  return apiFetch('/api/history');
}
