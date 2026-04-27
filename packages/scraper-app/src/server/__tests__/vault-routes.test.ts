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
  process.env['VAULT_FILE'] = vaultPath;
  await saveVaultFile(vaultPath, defaultVault(), PASSWORD);

  app = Fastify();
  await registerVaultRoutes(app);
  await app.ready();
});

afterEach(async () => {
  lockVault();
  await app.close();
  await rm(vaultPath, { force: true });
  delete process.env['VAULT_FILE'];
});

describe('GET /api/vault/status', () => {
  it('returns locked=true and hasFile=true before unlock', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vault/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ locked: true, hasFile: true });
  });

  it('returns locked=false after successful unlock', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/vault/unlock',
      payload: { password: PASSWORD },
    });
    const res = await app.inject({ method: 'GET', url: '/api/vault/status' });
    expect(res.json()).toMatchObject({ locked: false, hasFile: true });
  });
});

describe('POST /api/vault/unlock', () => {
  it('returns ok with correct password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vault/unlock',
      payload: { password: PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('returns 401 with wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vault/unlock',
      payload: { password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
  });
});
