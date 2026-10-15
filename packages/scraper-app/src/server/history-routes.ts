import type { FastifyInstance } from 'fastify';
import { readHistory, readSessionHistory } from './history.js';
import { getVault, isLocked } from './vault-store.js';

export async function registerHistoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/history', async (_req, reply) => {
    if (isLocked()) return reply.status(401).send({ error: 'vault-locked' });
    const { persistHistory, historyFilePath } = getVault().settings;
    if (persistHistory) {
      return { records: await readHistory(historyFilePath), persisted: true };
    }
    return { records: readSessionHistory(), persisted: false };
  });
}
