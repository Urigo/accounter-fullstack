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

describe('GET /api/vault/sources', () => {
  it('returns empty list initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vault/sources' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns 401 when vault is locked', async () => {
    lockVault();
    const res = await app.inject({ method: 'GET', url: '/api/vault/sources' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/vault/sources', () => {
  it('appends a poalim source and returns updated list', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vault/sources',
      payload: { type: 'poalim', userCode: 'user1', password: 'pass1' },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json() as Array<{ type: string; userCode: string; id: string }>;
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe('poalim');
    expect(list[0].userCode).toBe('user1');
    expect(list[0].id).toBeTruthy();
  });

  it('appends a discount source', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vault/sources',
      payload: { type: 'discount', ID: 'D123', password: 'pass2' },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json() as Array<{ type: string }>;
    expect(list[0].type).toBe('discount');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vault/sources',
      payload: { type: 'poalim' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when vault is locked', async () => {
    lockVault();
    const res = await app.inject({
      method: 'POST',
      url: '/api/vault/sources',
      payload: { type: 'poalim', userCode: 'user1', password: 'pass1' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('PUT /api/vault/sources/:id', () => {
  it('updates a source and returns updated list', async () => {
    const addRes = await app.inject({
      method: 'POST',
      url: '/api/vault/sources',
      payload: { type: 'poalim', userCode: 'user1', password: 'pass1' },
    });
    const [added] = addRes.json() as Array<{ id: string; nickname?: string }>;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/vault/sources/${added.id}`,
      payload: { nickname: 'My Poalim' },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json() as Array<{ id: string; nickname?: string }>;
    expect(list[0].nickname).toBe('My Poalim');
  });

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/sources/does-not-exist',
      payload: { nickname: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/vault/sources/:id', () => {
  it('removes a source and returns updated list', async () => {
    const addRes = await app.inject({
      method: 'POST',
      url: '/api/vault/sources',
      payload: { type: 'max', username: 'maxuser', password: 'pass3' },
    });
    const [added] = addRes.json() as Array<{ id: string }>;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/vault/sources/${added.id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/vault/sources/ghost' });
    expect(res.statusCode).toBe(404);
  });
});
