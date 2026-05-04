import type { FastifyInstance } from 'fastify';
import { getVault, isLocked, updateVault } from './vault-store.js';

type StatusBody = { status: 'accepted' | 'ignored' };

function guardLocked(reply: { status(code: number): { send(body: unknown): unknown } }) {
  if (isLocked()) return reply.status(401).send({ error: 'vault-locked' });
  return null;
}

export async function registerAccountsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/vault/accounts', async (_req, reply) => {
    const blocked = guardLocked(reply);
    if (blocked) return blocked;
    const vault = getVault();
    const { accountRecords } = vault;
    return accountRecords.map(r => ({
      ...r,
      nickname: (
        vault[`${r.sourceType}Accounts` as keyof typeof vault] as {
          id: string;
          nickname?: string;
        }[]
      ).find(a => a.id === r.sourceId)?.nickname,
    }));
  });

  app.put<{ Params: { id: string }; Body: StatusBody }>(
    '/api/vault/accounts/:id',
    async (req, reply) => {
      const blocked = guardLocked(reply);
      if (blocked) return blocked;

      const { id } = req.params;
      const { status } = req.body;

      if (status !== 'accepted' && status !== 'ignored') {
        return reply.status(400).send({ error: 'status must be accepted or ignored' });
      }

      const vault = getVault();
      if (!vault.accountRecords.some(a => a.id === id)) {
        return reply.status(404).send({ error: 'not-found' });
      }

      await updateVault(v => {
        const idx = v.accountRecords.findIndex(a => a.id === id);
        if (idx === -1) return v;
        const accounts = [...v.accountRecords];
        accounts[idx] = { ...accounts[idx], status };
        return { ...v, accountRecords: accounts };
      });

      return getVault().accountRecords;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/vault/accounts/:id', async (req, reply) => {
    const blocked = guardLocked(reply);
    if (blocked) return blocked;

    const { id } = req.params;
    if (!getVault().accountRecords.some(a => a.id === id)) {
      return reply.status(404).send({ error: 'not-found' });
    }

    await updateVault(v => ({
      ...v,
      accountRecords: v.accountRecords.filter(a => a.id !== id),
    }));

    return getVault().accountRecords;
  });
}
