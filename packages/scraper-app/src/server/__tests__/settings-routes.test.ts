import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultVault, saveVaultFile } from '../vault.js';
import { lockVault } from '../vault-store.js';
import { registerVaultRoutes } from '../vault-routes.js';

const PASSWORD = 'test-password-123';

let vaultPath: string;
let app: FastifyInstance;

beforeEach(async () => {
  vaultPath = join(tmpdir(), `vault-test-${randomBytes(4).toString('hex')}.vault`);
  process.env['VAULT_PATH'] = vaultPath;
  await saveVaultFile(vaultPath, defaultVault(), PASSWORD);

  app = Fastify();
  await registerVaultRoutes(app);
  await app.ready();

  await app.inject({
    method: 'POST',
    url: '/api/vault/unlock',
    payload: { password: PASSWORD },
  });
});

afterEach(async () => {
  lockVault();
  await app.close();
  await rm(vaultPath, { force: true });
  delete process.env['VAULT_PATH'];
});

describe('GET /api/vault/settings', () => {
  it('returns default settings after unlock', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vault/settings' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      showBrowser: false,
      fetchBankOfIsraelRates: true,
      concurrentScraping: true,
    });
  });

  it('returns 401 when vault is locked', async () => {
    lockVault();
    const res = await app.inject({ method: 'GET', url: '/api/vault/settings' });
    expect(res.statusCode).toBe(401);
  });
});

describe('PUT /api/vault/settings', () => {
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

  it('survives re-lock and re-unlock (persisted to disk)', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/vault/settings',
      payload: { serverUrl: 'https://persisted.example' },
    });

    lockVault();
    await app.inject({
      method: 'POST',
      url: '/api/vault/unlock',
      payload: { password: PASSWORD },
    });

    const res = await app.inject({ method: 'GET', url: '/api/vault/settings' });
    expect(res.json()).toMatchObject({ serverUrl: 'https://persisted.example' });
  });

  it('returns 401 when vault is locked', async () => {
    lockVault();
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
