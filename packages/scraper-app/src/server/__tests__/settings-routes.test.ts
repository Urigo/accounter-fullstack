import { randomBytes } from 'node:crypto';
import { access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultVault, saveVaultFile } from '../vault.js';
import { lockVault } from '../vault-store.js';
import { registerVaultRoutes } from '../vault-routes.js';

const PASSWORD = 'test-password-123';

function makeTmpPath() {
  return join(tmpdir(), `vault-test-${randomBytes(4).toString('hex')}.vault`);
}

let vaultPath: string;
let app: FastifyInstance;

beforeEach(async () => {
  vaultPath = makeTmpPath();
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
      concurrentScraping: false,
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

describe('PUT /api/vault/settings — vaultPath change', () => {
  let newPath: string;

  beforeEach(() => {
    newPath = makeTmpPath();
  });

  afterEach(async () => {
    await rm(newPath, { force: true });
  });

  it('moves the vault file and returns updated settings when vaultPath changes', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/settings',
      payload: { vaultPath: newPath },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().vaultPath).toBe(newPath);

    const oldExists = await access(vaultPath).then(() => true).catch(() => false);
    expect(oldExists).toBe(false);

    const newExists = await access(newPath).then(() => true).catch(() => false);
    expect(newExists).toBe(true);
  });

  it('returns 200 without moving anything when vaultPath is not in the payload', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/vault/settings',
      payload: { showBrowser: true },
    });
    const exists = await access(vaultPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('returns 500 when destination file already exists', async () => {
    await saveVaultFile(newPath, defaultVault(), 'other-password');
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/settings',
      payload: { vaultPath: newPath },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'move-failed' });
    const originalExists = await access(vaultPath).then(() => true).catch(() => false);
    expect(originalExists).toBe(true);
  });
});
