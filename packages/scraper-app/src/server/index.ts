import { pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerHistoryRoutes } from './history-routes.js';
import { registerVaultRoutes } from './vault-routes.js';
import { registerWebSocketRoute } from './websocket.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  app.get('/healthz', async () => ({ ok: true }));

  await registerVaultRoutes(app);
  await registerHistoryRoutes(app);
  await registerWebSocketRoute(app);

  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = process.env['PORT'] ? Number(process.env['PORT']) : 4001;
  const app = await buildServer();
  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
