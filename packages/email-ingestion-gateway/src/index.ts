import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { env } from './environment.js';
import { generateCorrelationId, log } from './logger.js';
import { ServerClient } from './server-client.js';
import type { HealthResponse, JsonObject, ReadinessResponse } from './types.js';
import { CloudflareAuthenticityVerifier } from './verifier.js';
import { createWebhookHandler } from './webhook.js';

const PORT = env.general.port;

// Fail fast in production when v2 is enabled without a signing secret — an empty
// HMAC key allows any attacker to forge valid signatures.
if (process.env.NODE_ENV === 'production' && !env.cloudflare.webhookSecret) {
  throw new Error('CF_WEBHOOK_SECRET must be configured in production');
}

export function sendJson(res: ServerResponse, statusCode: number, data: JsonObject): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const webhookHandler = createWebhookHandler({
  verifier: new CloudflareAuthenticityVerifier({
    webhookSecret: env.cloudflare.webhookSecret,
    ipAllowlist: [...env.cloudflare.ipAllowlist],
  }),
  featureFlags: env.featureFlags,
  serverClient: new ServerClient({
    serverUrl: env.server.url,
    cpToken: env.server.cpToken,
  }),
});

export const routes: Record<
  string,
  Record<string, (req: IncomingMessage, res: ServerResponse) => void | Promise<void>>
> = {
  GET: {
    '/health': (_req, res) => {
      const body: HealthResponse = { status: 'ok' };
      sendJson(res, 200, body);
    },
    '/readiness': (_req, res) => {
      const body: ReadinessResponse = { ready: true };
      sendJson(res, 200, body);
    },
  },
  POST: {
    '/webhook': webhookHandler,
  },
};

export async function requestHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const correlationId =
    (req.headers['x-correlation-id'] as string | undefined) ?? generateCorrelationId();
  res.setHeader('X-Correlation-Id', correlationId);

  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

    log('info', 'incoming request', { method: req.method, path: url.pathname }, correlationId);

    const handler = routes[req.method ?? '']?.[url.pathname];
    if (handler) {
      await handler(req, res);
    } else {
      sendJson(res, 404, { error: 'Not found' });
    }
  } catch (err) {
    log('error', 'unhandled request error', { error: String(err) }, correlationId);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal server error' });
    }
  }
}

export const server = createServer(requestHandler);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    log('info', 'gateway started', { port: PORT });
  });
}
