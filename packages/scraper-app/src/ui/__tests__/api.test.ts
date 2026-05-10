// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getEnvVaultPath, vaultDownload, vaultUpload } from '../lib/api.js';

afterEach(() => vi.unstubAllGlobals());

describe('getEnvVaultPath', () => {
  it('returns the path from the server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ path: '/custom/.vault' }) }),
    );
    const result = await getEnvVaultPath();
    expect(result.path).toBe('/custom/.vault');
  });
});

describe('vaultUpload', () => {
  it('POSTs to /api/vault/upload with octet-stream', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['data'], 'vault');
    await vaultUpload(file);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/vault/upload',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/octet-stream' }),
      }),
    );
  });

  it('appends ?force=true when force=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await vaultUpload(new File(['d'], 'v'), true);
    expect(fetchMock.mock.calls[0][0]).toContain('force=true');
  });

  it('throws ApiError with status 409 on conflict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'vault-already-exists' }),
      }),
    );
    await expect(vaultUpload(new File(['d'], 'v'))).rejects.toBeInstanceOf(ApiError);
  });
});

describe('vaultDownload', () => {
  it('creates and clicks a download link', async () => {
    const blob = new Blob(['data']);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue(
      Object.assign(document.createElement('a'), { click: clickSpy }),
    );
    await vaultDownload('.vault');
    expect(clickSpy).toHaveBeenCalled();
  });
});
