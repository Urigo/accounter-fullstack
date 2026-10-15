import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistSessionHistory } from '../history.js';
import { defaultVault, encryptVault } from '../vault.js';
import { closeVault, getSessionInfo, openVault } from '../vault-store.js';
import { registerVaultRoutes } from '../vault-routes.js';

vi.mock('../history.js', () => ({ persistSessionHistory: vi.fn(async () => undefined) }));

const PASSWORD = 'test-password-123';

let app: FastifyInstance;

beforeEach(async () => {
  await openVault(await encryptVault(defaultVault(), PASSWORD), PASSWORD, 'test.vault');

  app = Fastify();
  await registerVaultRoutes(app);
  await app.ready();
});

afterEach(async () => {
  vi.mocked(persistSessionHistory).mockClear();
  closeVault();
  await app.close();
});

describe('GET /api/vault/settings', () => {
  it('returns default settings after unlock', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vault/settings' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      showBrowser: false,
      fetchBankOfIsraelRates: true,
      concurrentScraping: false,
    });
  });

  it('returns 401 when vault is locked', async () => {
    closeVault();
    const res = await app.inject({ method: 'GET', url: '/api/vault/settings' });
    expect(res.statusCode).toBe(401);
  });
});

describe('PUT /api/vault/settings', () => {
  it('saving one setting leaves the others untouched', async () => {
    const put = (payload: Record<string, unknown>) =>
      app.inject({ method: 'PUT', url: '/api/vault/settings', payload });

    await put({ fetchBankOfIsraelRates: false });
    let settings = (await put({ showBrowser: true })).json() as Record<string, unknown>;
    expect(settings).toMatchObject({ showBrowser: true, fetchBankOfIsraelRates: false });

    settings = (await put({ fetchBankOfIsraelRates: true })).json() as Record<string, unknown>;
    expect(settings).toMatchObject({ showBrowser: true, fetchBankOfIsraelRates: true });

    await put({ persistHistory: true, defaultDateRangeMonths: 6 });
    settings = (await put({ concurrentScraping: true })).json() as Record<string, unknown>;
    expect(settings).toMatchObject({ persistHistory: true, defaultDateRangeMonths: 6 });
  });

  it('writes the session history to the file when history persistence is turned on', async () => {
    const put = (payload: Record<string, unknown>) =>
      app.inject({ method: 'PUT', url: '/api/vault/settings', payload });

    await put({ persistHistory: true, historyFilePath: '/tmp/runs.json' });
    expect(persistSessionHistory).toHaveBeenCalledExactlyOnceWith('/tmp/runs.json');

    // Already on: nothing more to flush.
    await put({ persistHistory: true });
    await put({ showBrowser: true });
    expect(persistSessionHistory).toHaveBeenCalledOnce();
  });

  it('merges partial update and persists', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/settings',
      payload: { showBrowser: true, serverUrl: 'https://example.com' },
    });
    expect(res.statusCode).toBe(200);
    const settings = res.json() as Record<string, unknown>;
    expect(settings.showBrowser).toBe(true);
    expect(settings.serverUrl).toBe('https://example.com');
    expect(settings.fetchBankOfIsraelRates).toBe(true);
  });

  it('GET after PUT reflects saved value', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/vault/settings',
      payload: { apiKey: 'my-key' },
    });
    const res = await app.inject({ method: 'GET', url: '/api/vault/settings' });
    expect(res.json()).toMatchObject({ apiKey: 'my-key' });
  });

  it('survives an export and re-open of the vault file', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/vault/settings',
      payload: { serverUrl: 'https://persisted.example' },
    });

    const { blob } = (
      await app.inject({
        method: 'POST',
        url: '/api/vault/export',
        payload: { sessionId: getSessionInfo().sessionId },
      })
    ).json() as { blob: string };
    closeVault();
    await app.inject({
      method: 'POST',
      url: '/api/vault/open',
      payload: { blob, password: PASSWORD, fileName: 'test.vault' },
    });

    const res = await app.inject({ method: 'GET', url: '/api/vault/settings' });
    expect(res.json()).toMatchObject({ serverUrl: 'https://persisted.example' });
  });

  it('returns 401 when vault is locked', async () => {
    closeVault();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/settings',
      payload: { showBrowser: true },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for invalid field types', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/settings',
      payload: { showBrowser: 'not-a-boolean' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('PUT /api/vault/settings — vault file location', () => {
  it('ignores a legacy vaultPath key instead of moving anything', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/settings',
      payload: { vaultPath: '/tmp/elsewhere.vault' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty('vaultPath');
  });
});
