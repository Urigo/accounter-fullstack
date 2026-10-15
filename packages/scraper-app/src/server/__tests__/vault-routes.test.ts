import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { VaultChanges } from '../../shared/types.js';
import { decryptVault, defaultVault, encryptVault } from '../vault.js';
import { closeVault, isLocked } from '../vault-store.js';
import { registerVaultRoutes } from '../vault-routes.js';

const PASSWORD = 'test-password-123';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await registerVaultRoutes(app);
  await app.ready();
  return app;
}

let app: FastifyInstance;

async function openWith(blob: string, password = PASSWORD) {
  return app.inject({
    method: 'POST',
    url: '/api/vault/open',
    payload: { blob, password, fileName: 'mine.vault' },
  });
}

async function addSource(nickname = 'Main') {
  return app.inject({
    method: 'POST',
    url: '/api/vault/sources',
    payload: { type: 'max', nickname, username: 'u', password: 'p' },
  });
}

async function getChanges(): Promise<VaultChanges> {
  return (await app.inject({ method: 'GET', url: '/api/vault/changes' })).json();
}

describe('vault session routes', () => {
  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    closeVault();
    await app.close();
  });

  describe('GET /api/vault/status', () => {
    it('returns state=empty when no vault is open', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/vault/status' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ state: 'empty' });
    });

    it('returns file name, origin and changes once a vault is open', async () => {
      await openWith(await encryptVault(defaultVault(), PASSWORD));
      const res = await app.inject({ method: 'GET', url: '/api/vault/status' });
      expect(res.json()).toEqual({
        state: 'unlocked',
        origin: 'opened',
        fileName: 'mine.vault',
        changes: { dirty: false, neverSaved: false, items: [] },
      });
    });
  });

  describe('POST /api/vault/open', () => {
    it('unlocks the uploaded vault with the right password', async () => {
      const res = await openWith(await encryptVault(defaultVault(), PASSWORD));
      expect(res.statusCode).toBe(200);
      expect(isLocked()).toBe(false);
    });

    it('returns 401 for a wrong password', async () => {
      const res = await openWith(await encryptVault(defaultVault(), PASSWORD), 'wrong');
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ error: 'wrong-password' });
      expect(isLocked()).toBe(true);
    });

    it('returns 400 for something that is not a vault file', async () => {
      const res = await openWith('{"hello": "world"}');
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'invalid-file' });
    });
  });

  describe('POST /api/vault/create', () => {
    it('creates an in-memory vault that has never been saved', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/vault/create',
        payload: { password: PASSWORD, serverUrl: 'http://x/graphql', apiKey: 'k' },
      });
      expect(res.statusCode).toBe(201);
      const changes = await getChanges();
      expect(changes.dirty).toBe(true);
      expect(changes.neverSaved).toBe(true);
      expect(changes.items.map(i => i.id)).toEqual(['apiKey', 'serverUrl']);
    });

    it('returns 409 when a vault is already open', async () => {
      await openWith(await encryptVault(defaultVault(), PASSWORD));
      const res = await app.inject({
        method: 'POST',
        url: '/api/vault/create',
        payload: { password: PASSWORD, serverUrl: '', apiKey: '' },
      });
      expect(res.statusCode).toBe(409);
    });
  });

  describe('change tracking, export and save', () => {
    beforeEach(async () => {
      await openWith(await encryptVault(defaultVault(), PASSWORD));
    });

    it('reports an added source', async () => {
      const sources = (await addSource('Personal')).json() as { id: string }[];
      const changes = await getChanges();
      expect(changes.dirty).toBe(true);
      expect(changes.items).toEqual([
        {
          section: 'sources',
          kind: 'added',
          id: sources[0].id,
          sourceType: 'max',
          label: 'Personal',
        },
      ]);
    });

    it('is clean again when a change is reverted', async () => {
      await app.inject({ method: 'PUT', url: '/api/vault/settings', payload: { showBrowser: true } });
      expect((await getChanges()).dirty).toBe(true);
      await app.inject({
        method: 'PUT',
        url: '/api/vault/settings',
        payload: { showBrowser: false },
      });
      expect((await getChanges()).dirty).toBe(false);
    });

    it('never puts secret values in change items', async () => {
      await app.inject({
        method: 'PUT',
        url: '/api/vault/settings',
        payload: { apiKey: 'super-secret' },
      });
      expect(JSON.stringify(await getChanges())).not.toContain('super-secret');
    });

    it('export returns an encrypted vault holding the current state', async () => {
      await addSource('Exported');
      const res = await app.inject({ method: 'POST', url: '/api/vault/export' });
      expect(res.statusCode).toBe(200);
      const { blob, fileName } = res.json() as { blob: string; fileName: string };
      expect(fileName).toBe('mine.vault');
      const vault = await decryptVault(blob, PASSWORD);
      expect(vault?.maxAccounts[0]?.nickname).toBe('Exported');
    });

    it('stays dirty until the client confirms the file was written', async () => {
      await addSource();
      const { revision } = (
        await app.inject({ method: 'POST', url: '/api/vault/export' })
      ).json() as { revision: number };
      expect((await getChanges()).dirty).toBe(true);

      const res = await app.inject({
        method: 'POST',
        url: '/api/vault/saved',
        payload: { revision },
      });
      expect(res.json()).toMatchObject({ ok: true, changes: { dirty: false } });
    });

    it('keeps changes made after the export as unsaved', async () => {
      await addSource('First');
      const { revision } = (
        await app.inject({ method: 'POST', url: '/api/vault/export' })
      ).json() as { revision: number };
      await addSource('Second');
      await app.inject({ method: 'POST', url: '/api/vault/saved', payload: { revision } });

      const changes = await getChanges();
      expect(changes.dirty).toBe(true);
      expect(changes.items.map(i => i.label)).toEqual(['Second']);
    });

    it('ignores a save confirmation for an export that is not the latest', async () => {
      await addSource();
      const first = (await app.inject({ method: 'POST', url: '/api/vault/export' })).json();
      await addSource('Later');
      await app.inject({ method: 'POST', url: '/api/vault/export' });
      const res = await app.inject({
        method: 'POST',
        url: '/api/vault/saved',
        payload: { revision: (first as { revision: number }).revision },
      });
      expect(res.json()).toMatchObject({ ok: false, changes: { dirty: true } });
    });

    it('close clears the session', async () => {
      await app.inject({ method: 'POST', url: '/api/vault/close' });
      expect(isLocked()).toBe(true);
      expect((await app.inject({ method: 'GET', url: '/api/vault/changes' })).statusCode).toBe(
        401,
      );
    });
  });

  it.each([
    ['POST', '/api/vault/unlock'],
    ['POST', '/api/vault/upload'],
    ['GET', '/api/vault/download'],
    ['GET', '/api/vault/env-path'],
    ['GET', '/api/vault/path'],
  ] as const)('no longer serves %s %s', async (method, url) => {
    const res = await app.inject({ method, url });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/vault/test-connection', () => {
  const SERVER_URL = 'http://localhost:4000/graphql';
  const API_KEY = 'scraper-key-1';

  let app: FastifyInstance;
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  function mockReply(body: string, init?: { status?: number; contentType?: string }) {
    fetchSpy.mockResolvedValue(
      new Response(body, {
        status: init?.status ?? 200,
        headers: { 'content-type': init?.contentType ?? 'application/json' },
      }),
    );
  }

  beforeEach(async () => {
    app = await buildApp();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    await app.inject({
      method: 'POST',
      url: '/api/vault/create',
      payload: { password: PASSWORD, serverUrl: SERVER_URL, apiKey: API_KEY },
    });
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
    closeVault();
    await app.close();
  });

  it('probes with the same X-API-Key header the upload client sends', async () => {
    mockReply(JSON.stringify({ data: { __typename: 'Query' } }));

    await app.inject({ method: 'GET', url: '/api/vault/test-connection' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(SERVER_URL);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe(API_KEY);
    expect(headers['Authorization']).toBeUndefined();
  });

  it('reports ok for a real GraphQL result', async () => {
    mockReply(JSON.stringify({ data: { __typename: 'Query' } }));

    const res = await app.inject({ method: 'GET', url: '/api/vault/test-connection' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    expect(res.json().latencyMs).toBeTypeOf('number');
  });

  it('fails on a 200 that is really a SPA index.html', async () => {
    // The regression this route missed: a serverUrl pointing at a SPA (this very app)
    // answers an unknown path with index.html and a 200, which used to read as healthy.
    mockReply('<!doctype html>\n<html lang="en"><head><title>Scraper App</title></head></html>', {
      contentType: 'text/html',
    });

    const res = await app.inject({ method: 'GET', url: '/api/vault/test-connection' });

    expect(res.json().ok).toBe(false);
    expect(res.json().error).toContain('did not return JSON');
    expect(res.json().error).toContain('/graphql');
  });

  it('surfaces a GraphQL error message', async () => {
    mockReply(JSON.stringify({ errors: [{ message: 'Unauthorized' }] }));

    const res = await app.inject({ method: 'GET', url: '/api/vault/test-connection' });

    expect(res.json()).toMatchObject({ ok: false, error: 'Unauthorized' });
  });

  it('fails on valid JSON that is not a GraphQL result', async () => {
    mockReply(JSON.stringify({ hello: 'world' }));

    const res = await app.inject({ method: 'GET', url: '/api/vault/test-connection' });

    expect(res.json()).toMatchObject({ ok: false });
    expect(res.json().error).toContain('did not return a GraphQL result');
  });

  it('reports the status and body of a non-2xx response', async () => {
    mockReply('nope', { status: 502, contentType: 'text/plain' });

    const res = await app.inject({ method: 'GET', url: '/api/vault/test-connection' });

    expect(res.json()).toMatchObject({ ok: false, error: 'HTTP 502: nope' });
  });

  it('returns 401 when the vault is locked', async () => {
    closeVault();

    const res = await app.inject({ method: 'GET', url: '/api/vault/test-connection' });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'vault-locked' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
