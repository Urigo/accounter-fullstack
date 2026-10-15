import type { FastifyInstance } from 'fastify';
import { getVault, isLocked, updateVault } from './vault-store.js';
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

    // Zod 4's `.partial()` still fills in field defaults, so the parsed object carries every
    // defaulted key. Apply only the keys the client sent, or saving one toggle resets the others.
    const sent = new Set(Object.keys(req.body ?? {}));
    const patch = Object.fromEntries(
      Object.entries(parsed.data).filter(([key]) => sent.has(key)),
    ) as Partial<Settings>;

    await updateVault(v => ({ ...v, settings: { ...v.settings, ...patch } }));
    return getVault().settings;
  });
}
