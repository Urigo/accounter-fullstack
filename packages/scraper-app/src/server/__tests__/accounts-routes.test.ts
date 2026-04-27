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

  const vault = defaultVault();
  vault.bankAccounts.push({
    id: 'acc-1',
    sourceId: 'src-a',
    sourceType: 'poalim',
    accountNumber: '123456',
    branchNumber: '700',
    status: 'pending',
  });
  await saveVaultFile(vaultPath, vault, PASSWORD);

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
  delete process.env['VAULT_FILE'];
});

describe('GET /api/vault/accounts', () => {
  it('returns the pre-seeded account', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vault/accounts' });
    expect(res.statusCode).toBe(200);
    const list = res.json() as Array<{ id: string; status: string }>;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('acc-1');
    expect(list[0].status).toBe('pending');
  });

  it('returns 401 when vault is locked', async () => {
    lockVault();
    const res = await app.inject({ method: 'GET', url: '/api/vault/accounts' });
    expect(res.statusCode).toBe(401);
  });
});

describe('PUT /api/vault/accounts/:id', () => {
  it('sets status to accepted and returns updated list', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/accounts/acc-1',
      payload: { status: 'accepted' },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json() as Array<{ id: string; status: string }>;
    expect(list[0].status).toBe('accepted');
  });

  it('sets status to ignored', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/accounts/acc-1',
      payload: { status: 'ignored' },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as Array<{ status: string }>)[0].status).toBe('ignored');
  });

  it('persists across re-lock/unlock', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/vault/accounts/acc-1',
      payload: { status: 'accepted' },
    });

    lockVault();
    await app.inject({
      method: 'POST',
      url: '/api/vault/unlock',
      payload: { password: PASSWORD },
    });

    const res = await app.inject({ method: 'GET', url: '/api/vault/accounts' });
    expect((res.json() as Array<{ status: string }>)[0].status).toBe('accepted');
  });

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/accounts/does-not-exist',
      payload: { status: 'accepted' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for invalid status value', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/accounts/acc-1',
      payload: { status: 'pending' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when vault is locked', async () => {
    lockVault();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/vault/accounts/acc-1',
      payload: { status: 'accepted' },
    });
    expect(res.statusCode).toBe(401);
  });
});
