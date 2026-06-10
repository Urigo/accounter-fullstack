/* eslint-disable no-console */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { env } from './environment.js';
import type { HealthResponse, JsonObject } from './types.js';

const PORT = env.general.port;

export function sendJson(res: ServerResponse, statusCode: number, data: JsonObject): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export const routes: Record<
  string,
  Record<string, (req: IncomingMessage, res: ServerResponse) => void | Promise<void>>
> = {
  GET: {
    '/health': (_req, res) => {
      const body: HealthResponse = { status: 'ok' };
      sendJson(res, 200, body);
    },
  },
};

export const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const handler = routes[req.method ?? '']?.[url.pathname];
    if (handler) {
      await handler(req, res);
    } else {
      sendJson(res, 404, { error: 'Not found' });
    }
  } catch (err) {
    console.error('[gateway] Unhandled request error:', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[email-ingestion-gateway] Listening on port ${PORT}`);
  });
}
