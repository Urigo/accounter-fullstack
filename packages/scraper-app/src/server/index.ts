import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import staticPlugin from '@fastify/static';
import { registerHistoryRoutes } from './history-routes.js';
import { registerVaultRoutes } from './vault-routes.js';
import { registerWebSocketRoute } from './websocket.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  app.get('/healthz', async () => ({ ok: true }));

  await registerVaultRoutes(app);
  await registerHistoryRoutes(app);
  await registerWebSocketRoute(app);

  // Serve compiled UI in production (dist/ui built by `yarn build:ui`)
  // Server bundle is at dist/server/index.js; Vite outputs the SPA to dist/ui/
  const uiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../ui');
  if (existsSync(uiRoot)) {
    await app.register(staticPlugin, { root: uiRoot, prefix: '/', wildcard: true });
    // Serve index.html for any path that doesn't match a static asset (SPA client-side routing).
    //
    // Only for browser navigations, though. `sendFile` answers with a 200, so letting
    // this handler catch an API call, a websocket upgrade or a non-GET verb turns a
    // mistyped URL into HTML-with-a-200 — which is how pointing the vault's serverUrl at
    // this app instead of the Accounter server surfaced as an unreadable
    // "Invalid execution result: result is not object or array" from graphql-request.
    app.setNotFoundHandler((req, reply) => {
      const isNavigation =
        (req.method === 'GET' || req.method === 'HEAD') &&
        !req.url.startsWith('/api/') &&
        !req.url.startsWith('/ws');
      if (!isNavigation) {
        return reply.status(404).send({ error: 'not-found', method: req.method, url: req.url });
      }
      return reply.sendFile('index.html');
    });
  }

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
