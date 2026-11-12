// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, saveSettings, vaultEvents, vaultExport, vaultOpen } from '../lib/api.js';

afterEach(() => vi.unstubAllGlobals());

function okFetch(body: unknown = { ok: true }) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('vaultOpen', () => {
  it('POSTs the file contents, password and file name as JSON', async () => {
    const fetchMock = okFetch();
    await vaultOpen('BLOB', 'pw', 'mine.vault');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/vault/open',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ blob: 'BLOB', password: 'pw', fileName: 'mine.vault' }),
      }),
    );
  });

  it('throws ApiError with the status on a wrong password', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'wrong-password' }),
      }),
    );
    const err = await vaultOpen('B', 'x', 'f').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
  });
});

describe('vault-changed events', () => {
  it('fires after a request that edits the vault', async () => {
    okFetch({});
    const listener = vi.fn();
    vaultEvents.addEventListener('vault-changed', listener);
    await saveSettings({ showBrowser: true });
    vaultEvents.removeEventListener('vault-changed', listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not fire for session requests such as export', async () => {
    okFetch({ blob: 'b', revision: 1, fileName: 'f' });
    const listener = vi.fn();
    vaultEvents.addEventListener('vault-changed', listener);
    await vaultExport('session-1');
    vaultEvents.removeEventListener('vault-changed', listener);
    expect(listener).not.toHaveBeenCalled();
  });
});
