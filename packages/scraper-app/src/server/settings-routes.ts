import type { FastifyInstance } from 'fastify';
import {
  getCurrentVaultPath,
  getVault,
  isLocked,
  moveVaultFile,
  updateVault,
} from './vault-store.js';
import { SettingsSchema, type Settings } from './vault.js';

function guardLocked(reply: { status(code: number): { send(body: unknown): unknown } }) {
  if (isLocked()) return reply.status(401).send({ error: 'vault-locked' });
  return null;
}

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/vault/settings', async (_req, reply) => {
    const blocked = guardLocked(reply);
    if (blocked) return blocked;
    return getVault().settings;
  });

  app.put<{ Body: Partial<Settings> }>('/api/vault/settings', async (req, reply) => {
    const blocked = guardLocked(reply);
    if (blocked) return blocked;

    const parsed = SettingsSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.issues });

    const newPath = parsed.data.vaultPath;
    if (newPath !== undefined && newPath !== getCurrentVaultPath()) {
      try {
        await moveVaultFile(newPath);
      } catch {
        return reply.status(500).send({ error: 'move-failed' });
      }
    }

    await updateVault(v => ({ ...v, settings: { ...v.settings, ...parsed.data } }));
    return getVault().settings;
  });
}
