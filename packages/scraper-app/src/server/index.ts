import Fastify from 'fastify';
import { registerVaultRoutes } from './vault-routes.js';
import { registerWebSocketRoute } from './websocket.js';

const app = Fastify({ logger: true });

app.get('/healthz', async () => {
  return { ok: true };
});

try {
  await registerVaultRoutes(app);
  await registerWebSocketRoute(app);
  await app.listen({ port: 3002, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
