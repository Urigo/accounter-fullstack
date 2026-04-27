import type { FastifyInstance } from 'fastify';
import { hasVaultFile, isLocked, lockVault, unlockVault } from './vault-store.js';
import { defaultVault, saveVaultFile } from './vault.js';

function getVaultPath(): string {
  return process.env['VAULT_FILE'] ?? '.vault';
}

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
      const { password, serverUrl, apiKey } = req.body;
      lockVault();
      const vault = defaultVault();
      vault.settings.serverUrl = serverUrl;
      vault.settings.apiKey = apiKey;
      await saveVaultFile(getVaultPath(), vault, password);
      const result = await unlockVault(password);
      if (result !== 'ok') return reply.status(500).send({ error: result });
      return { ok: true };
    },
  );
}
