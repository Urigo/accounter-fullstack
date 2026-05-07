import { readFile, rename, writeFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { registerAccountsRoutes } from './accounts-routes.js';
import { registerSettingsRoutes } from './settings-routes.js';
import { registerSourcesRoutes } from './sources-routes.js';
import { getVault, hasVaultFile, isLocked, lockVault, unlockVault } from './vault-store.js';
import { defaultVault, getVaultPath, saveVaultFile } from './vault.js';

type UnlockBody = { password: string };
type CreateBody = { password: string; serverUrl: string; apiKey: string };

export async function registerVaultRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/vault/status', async () => ({
    locked: isLocked(),
    hasFile: await hasVaultFile(),
  }));

  app.post<{ Body: UnlockBody }>(
    '/api/vault/unlock',
    {
      schema: {
        body: {
          type: 'object',
          required: ['password'],
          properties: { password: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const result = await unlockVault(req.body.password);
      if (result === 'ok') return { ok: true };
      const status = result === 'not-found' ? 404 : 401;
      return reply.status(status).send({ error: result });
    },
  );

  app.post<{ Body: CreateBody }>(
    '/api/vault/create',
    {
      schema: {
        body: {
          type: 'object',
          required: ['password', 'serverUrl', 'apiKey'],
          properties: {
            password: { type: 'string' },
            serverUrl: { type: 'string' },
            apiKey: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (await hasVaultFile()) return reply.status(409).send({ error: 'vault-already-exists' });
      const { password, serverUrl, apiKey } = req.body;
      lockVault();
      const vault = defaultVault();
      vault.settings.serverUrl = serverUrl;
      vault.settings.apiKey = apiKey;
      await saveVaultFile(getVaultPath(), vault, password);
      const result = await unlockVault(password);
      if (result !== 'ok') return reply.status(500).send({ error: result });
      return reply.status(201).send({ ok: true });
    },
  );

  app.get('/api/vault/env-path', async () => ({
    path: getVaultPath(),
  }));

  app.get('/api/vault/download', async (_req, reply) => {
    try {
      const fileBuffer = await readFile(getVaultPath());
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Disposition', 'attachment; filename=".vault"');
      return reply.send(fileBuffer);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return reply.status(404).send({ error: 'no-vault-file' });
      }
      throw err;
    }
  });

  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );

  app.post<{ Querystring: { force?: string }; Body: Buffer }>(
    '/api/vault/upload',
    { config: { rawBody: false } },
    async (req, reply) => {
      const force = req.query.force === 'true';
      const vaultPath = getVaultPath();
      try {
        const exists = await hasVaultFile();
        if (exists && !force) {
          return reply.status(409).send({ error: 'vault-already-exists' });
        }
        await writeFile(vaultPath + '.tmp', req.body as Buffer);
        await rename(vaultPath + '.tmp', vaultPath);
        lockVault();
        return reply.status(200).send({ ok: true });
      } catch (err) {
        req.log.error(err, 'Vault upload failed');
        return reply.status(500).send({ error: 'write-failed' });
      }
    },
  );

  app.get('/api/vault/path', async (_req, reply) => {
    if (isLocked()) return reply.status(401).send({ error: 'vault-locked' });
    return { path: getVaultPath() };
  });

  app.get('/api/vault/test-connection', async (_req, reply) => {
    if (isLocked()) return reply.status(401).send({ error: 'vault-locked' });
    const { serverUrl, apiKey } = getVault().settings;
    if (!serverUrl || !apiKey) {
      return reply.status(400).send({ error: 'Server URL and API key are not configured' });
    }
    const t0 = Date.now();
    try {
      const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ query: '{ __typename }' }),
        signal: AbortSignal.timeout(10_000),
      });
      const latencyMs = Date.now() - t0;
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return { ok: false, error: `HTTP ${res.status}: ${text}`, latencyMs };
      }
      return { ok: true, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - t0;
      return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs };
    }
  });

  await registerSourcesRoutes(app);
  await registerSettingsRoutes(app);
  await registerAccountsRoutes(app);
}
