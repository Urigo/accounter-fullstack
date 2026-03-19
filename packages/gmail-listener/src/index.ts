/* eslint-disable no-console */

import { timingSafeEqual } from 'node:crypto';
import { createServer, ServerResponse, type IncomingMessage } from 'node:http';
import { env } from './environment.js';
import { GmailService } from './gmail-service.js';
import { PubsubService } from './pubsub-service.js';

const DAILY_PENDING_MESSAGES_INTERVAL_MS = 24 * 60 * 60 * 1000;
const INIT_MAX_RETRIES = 3;
const INIT_RETRY_DELAY_MS = 5000;
const PORT = env.general.port;

let gmailService: GmailService;
let pubsubService: PubsubService;

function startPendingMessagesCronJob(): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      console.log('[Scheduler] Running pending messages job...');
      const handled = await gmailService.handlePendingMessages();
      if (!handled) {
        console.error('[Scheduler] Pending messages job completed with errors.');
      }
    } catch (error) {
      console.error('[Scheduler] Pending messages job failed:', error);
    }
  }, DAILY_PENDING_MESSAGES_INTERVAL_MS);
}

async function init() {
  gmailService = new GmailService(env);

  try {
    await gmailService.init();

    pubsubService = new PubsubService(env, gmailService);

    try {
      const handled = await gmailService.handlePendingMessages();
      if (!handled) {
        console.error('[Init] Pending messages handling completed with errors.');
      }
    } catch (error) {
      console.error('[Init] Error handling pending messages:', error);
    }

    await pubsubService.startListening();
    startPendingMessagesCronJob();
  } catch (error) {
    console.error('[Init] Failed to initialize Gmail listener service:', error);
    throw error;
  }
}

async function bootstrap() {
  for (let attempt = 1; attempt <= INIT_MAX_RETRIES; attempt++) {
    try {
      await init();
      return;
    } catch (error) {
      const isLastAttempt = attempt === INIT_MAX_RETRIES;
      console.error(
        `[Bootstrap] Initialization attempt ${attempt}/${INIT_MAX_RETRIES} failed:`,
        error,
      );

      if (isLastAttempt) {
        console.error('[Bootstrap] Maximum initialization attempts reached. Shutting down.');
        process.exit(1);
      }

      await new Promise(resolve => setTimeout(resolve, INIT_RETRY_DELAY_MS));
    }
  }
}

function authenticate(req: IncomingMessage): boolean {
  const authHeader = req.headers.authorization;
  const providedKey = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.headers['x-api-key'] as string | undefined);

  if (!providedKey) {
    return false;
  }

  const expectedKey = env.authorization.apiKey;
  const providedKeyBuffer = Buffer.from(providedKey, 'utf8');
  const expectedKeyBuffer = Buffer.from(expectedKey, 'utf8');

  if (providedKeyBuffer.length !== expectedKeyBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedKeyBuffer, expectedKeyBuffer);
}

function sendJson(res: ServerResponse, statusCode: number, data: object) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const routes: Record<
  string,
  Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>
> = {
  GET: {
    '/health': async (req, res) => {
      const isHealthy = pubsubService ? await pubsubService.healthCheck() : false;
      sendJson(res, isHealthy ? 200 : 503, { healthy: isHealthy });
    },
  },
  POST: {
    // ... other POST routes
    '/start-listening': async (req, res) => {
      if (!pubsubService) {
        sendJson(res, 503, { error: 'Service not initialized' });
        return;
      }
      await pubsubService.startListening();
      sendJson(res, 200, { success: true });
    },
    '/stop-listening': async (req, res) => {
      if (!pubsubService) {
        sendJson(res, 503, { error: 'Service not initialized' });
        return;
      }
      pubsubService.stopListening();
      sendJson(res, 200, { success: true });
    },
    '/handle-pending-messages': async (req, res) => {
      if (!gmailService) {
        sendJson(res, 503, { error: 'Service not initialized' });
        return;
      }
      const handled = await gmailService.handlePendingMessages();
      sendJson(res, handled ? 200 : 500, { success: handled });
    },
  },
};

const server = createServer(async (req, res) => {
  if (!authenticate(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  const handler = routes[req.method ?? '']?.[url.pathname];
  if (handler) {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('[Server] Request error:', error);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  } else {
    sendJson(res, 404, { error: 'Not Found' });
  }
});

server.listen(PORT, () => {
  console.log(`[Server] HTTP server listening on port ${PORT}`);
  void bootstrap();
});
