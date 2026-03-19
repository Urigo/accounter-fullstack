/* eslint-disable no-console */

import { createServer, type IncomingMessage } from 'node:http';
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
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === env.authorization.apiKey;
  }
  const apiKey = req.headers['x-api-key'];
  return apiKey === env.authorization.apiKey;
}

const server = createServer(async (req, res) => {
  if (!authenticate(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const isHealthy = pubsubService ? await pubsubService.healthCheck() : false;
      res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ healthy: isHealthy }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/start-listening') {
      if (!pubsubService) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Service not initialized' }));
        return;
      }
      await pubsubService.startListening();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/stop-listening') {
      if (!pubsubService) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Service not initialized' }));
        return;
      }
      pubsubService.stopListening();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/handle-pending-messages') {
      if (!gmailService) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Service not initialized' }));
        return;
      }
      const handled = await gmailService.handlePendingMessages();
      res.writeHead(handled ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: handled }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    console.error('[Server] Request error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`[Server] HTTP server listening on port ${PORT}`);
  void bootstrap();
});
