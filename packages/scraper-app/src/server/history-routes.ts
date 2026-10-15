import type { FastifyInstance } from 'fastify';
import { readPersistedHistory, readSessionHistory } from './history.js';
import { getVault, isLocked } from './vault-store.js';

export async function registerHistoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/history', async (_req, reply) => {
    if (isLocked()) return reply.status(401).send({ error: 'vault-locked' });
    const { persistHistory, historyFilePath } = getVault().settings;
    if (persistHistory) {
      return { records: await readPersistedHistory(historyFilePath), persisted: true };
    }
    return { records: readSessionHistory(), persisted: false };
  });
}
