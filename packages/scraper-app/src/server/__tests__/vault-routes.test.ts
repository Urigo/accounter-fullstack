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

function makeTmpPath() {
  return join(tmpdir(), `vault-test-${randomBytes(4).toString('hex')}.vault`);
}

async function buildApp(vaultPath: string): Promise<FastifyInstance> {
  process.env['VAULT_PATH'] = vaultPath;
  const app = Fastify();
  await registerVaultRoutes(app);
  await app.ready();
  return app;
}

// ── Tests where the vault file does NOT yet exist ─────────────────────────────

describe('GET /api/vault/status', () => {
  let vaultPath: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    vaultPath = makeTmpPath();
    app = await buildApp(vaultPath);
  });

  afterEach(async () => {
    lockVault();
    await app.close();
    await rm(vaultPath, { force: true });
    delete process.env['VAULT_PATH'];
  });

  it('returns locked=true and hasFile=false when no vault file exists', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vault/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ locked: true, hasFile: false });
  });
});

// ── Tests for POST /api/vault/create ─────────────────────────────────────────

describe('POST /api/vault/create', () => {
  let vaultPath: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    vaultPath = makeTmpPath();
    app = await buildApp(vaultPath);
  });

  afterEach(async () => {
    lockVault();
    await app.close();
    await rm(vaultPath, { force: true });
    delete process.env['VAULT_PATH'];
  });

  it('creates a vault and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vault/create',
      payload: { password: PASSWORD, serverUrl: 'http://localhost:4000/graphql', apiKey: 'key1' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });
  });

  it('GET /api/vault/status after create returns locked=false and hasFile=true', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/vault/create',
      payload: { password: PASSWORD, serverUrl: 'http://localhost:4000/graphql', apiKey: 'key1' },
    });
    const res = await app.inject({ method: 'GET', url: '/api/vault/status' });
    expect(res.json()).toEqual({ locked: false, hasFile: true });
  });

  it('returns 409 when vault file already exists', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/vault/create',
      payload: { password: PASSWORD, serverUrl: 'http://localhost:4000/graphql', apiKey: 'key1' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/vault/create',
      payload: { password: PASSWORD, serverUrl: 'http://localhost:4000/graphql', apiKey: 'key1' },
    });
    expect(res.statusCode).toBe(409);
  });
});

// ── Tests where the vault file ALREADY exists ─────────────────────────────────

describe('GET /api/vault/status', () => {
  let vaultPath: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    vaultPath = makeTmpPath();
    await saveVaultFile(vaultPath, defaultVault(), PASSWORD);
    app = await buildApp(vaultPath);
  });

  afterEach(async () => {
    lockVault();
    await app.close();
    await rm(vaultPath, { force: true });
    delete process.env['VAULT_PATH'];
  });

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

describe('GET /api/vault/env-path', () => {
  let vaultPath: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    vaultPath = makeTmpPath();
    app = await buildApp(vaultPath);
    process.env['VAULT_PATH'] = '/tmp/custom.vault';
  });

  afterEach(async () => {
    lockVault();
    await app.close();
    await rm(vaultPath, { force: true });
    delete process.env['VAULT_PATH'];
  });

  it('returns the VAULT_PATH env var when set', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vault/env-path' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ path: '/tmp/custom.vault' });
  });

  it('returns ".vault" when VAULT_PATH is not set', async () => {
    delete process.env['VAULT_PATH'];
    const res = await app.inject({ method: 'GET', url: '/api/vault/env-path' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ path: '.vault' });
  });
});

describe('GET /api/vault/download', () => {
  describe('when vault file exists', () => {
    let vaultPath: string;
    let app: FastifyInstance;

    beforeEach(async () => {
      vaultPath = makeTmpPath();
      await saveVaultFile(vaultPath, defaultVault(), PASSWORD);
      app = await buildApp(vaultPath);
    });

    afterEach(async () => {
      lockVault();
      await app.close();
      await rm(vaultPath, { force: true });
      delete process.env['VAULT_PATH'];
    });

    it('returns 200 with octet-stream content-type when vault file exists', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/vault/download' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/octet-stream/);
      expect(res.headers['content-disposition']).toBe('attachment; filename=".vault"');
      expect(res.rawPayload.length).toBeGreaterThan(0);
    });
  });

  describe('when vault file does not exist', () => {
    let vaultPath: string;
    let app: FastifyInstance;

    beforeEach(async () => {
      vaultPath = makeTmpPath();
      app = await buildApp(vaultPath);
    });

    afterEach(async () => {
      lockVault();
      await app.close();
      await rm(vaultPath, { force: true });
      delete process.env['VAULT_PATH'];
    });

    it('returns 404 when no vault file exists', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/vault/download' });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('no-vault-file');
    });
  });
});

describe('POST /api/vault/unlock', () => {
  let vaultPath: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    vaultPath = makeTmpPath();
    await saveVaultFile(vaultPath, defaultVault(), PASSWORD);
    app = await buildApp(vaultPath);
  });

  afterEach(async () => {
    lockVault();
    await app.close();
    await rm(vaultPath, { force: true });
    delete process.env['VAULT_PATH'];
  });

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
