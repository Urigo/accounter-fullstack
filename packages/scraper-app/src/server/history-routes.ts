import type { FastifyInstance } from 'fastify';
import { readHistory } from './history.js';
import { getVault, isLocked } from './vault-store.js';

export async function registerHistoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/history', async (_req, reply) => {
    if (isLocked()) return reply.status(401).send({ error: 'vault-locked' });
    const { historyFilePath } = getVault().settings;
    return readHistory(historyFilePath);
  });
}
