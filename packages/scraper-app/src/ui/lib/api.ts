import type { AccountRecord, Settings } from '../../server/vault.js';
import type { RunRecord, VaultChanges, VaultStatusResponse } from '../../shared/types.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fires `vault-changed` after any request that may have edited the in-memory vault, so the
 * unsaved-changes indicator can refresh without polling.
 */
export const vaultEvents = new EventTarget();

const SESSION_ENDPOINTS = new Set([
  '/api/vault/open',
  '/api/vault/create',
  '/api/vault/export',
  '/api/vault/saved',
  '/api/vault/close',
]);

function mutatesVault(url: string, init?: RequestInit): boolean {
  const method = (init?.method ?? 'GET').toUpperCase();
  return method !== 'GET' && url.startsWith('/api/vault/') && !SESSION_ENDPOINTS.has(url);
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as T;
  if (mutatesVault(url, init)) vaultEvents.dispatchEvent(new Event('vault-changed'));
  return data;
}

function postJson<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

// ── Vault session ─────────────────────────────────────────────────────────────

export function vaultStatus(): Promise<VaultStatusResponse> {
  return apiFetch('/api/vault/status');
}

export type VaultSessionResponse = { ok: true; sessionId: string };

export function vaultOpen(
  blob: string,
  password: string,
  fileName: string,
): Promise<VaultSessionResponse> {
  return postJson('/api/vault/open', { blob, password, fileName });
}

export function vaultCreate(
  password: string,
  serverUrl: string,
  apiKey: string,
): Promise<VaultSessionResponse> {
  return postJson('/api/vault/create', { password, serverUrl, apiKey });
}

export function vaultChanges(): Promise<VaultChanges> {
  return apiFetch('/api/vault/changes');
}

/** Answers 409 when `sessionId` is no longer the open session (closed or replaced elsewhere). */
export function vaultExport(
  sessionId: string,
): Promise<{ blob: string; revision: number; fileName: string }> {
  return postJson('/api/vault/export', { sessionId });
}

export function vaultMarkSaved(
  sessionId: string,
  revision: number,
  fileName?: string,
): Promise<{ ok: boolean; changes: VaultChanges }> {
  return postJson('/api/vault/saved', { sessionId, revision, fileName });
}

export function vaultClose(): Promise<{ ok: boolean }> {
  return postJson('/api/vault/close');
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

/** What `/api/vault/accounts` returns: the stored record plus its source's nickname. */
export type VaultAccount = AccountRecord & { nickname?: string };

export function fetchAccounts(): Promise<VaultAccount[]> {
  return apiFetch('/api/vault/accounts');
}

export function updateStatus(id: string, status: 'accepted' | 'ignored'): Promise<VaultAccount[]> {
  return apiFetch(`/api/vault/accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export function deleteAccount(id: string): Promise<VaultAccount[]> {
  return apiFetch(`/api/vault/accounts/${id}`, { method: 'DELETE' });
}

// ── Connection test ───────────────────────────────────────────────────────────

export function testConnection(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  return apiFetch('/api/vault/test-connection');
}

// ── History ───────────────────────────────────────────────────────────────────

export function getHistory(): Promise<{ records: RunRecord[]; persisted: boolean }> {
  return apiFetch('/api/history');
}
