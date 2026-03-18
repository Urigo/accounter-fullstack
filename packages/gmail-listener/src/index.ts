/* eslint-disable no-console */

import { env } from './environment.js';
import { GmailService } from './gmail-service.js';
import { PubsubService } from './pubsub-service.js';

const DAILY_PENDING_MESSAGES_INTERVAL_MS = 24 * 60 * 60 * 1000;
const INIT_MAX_RETRIES = 3;
const INIT_RETRY_DELAY_MS = 5000;

function startPendingMessagesCronJob(gmailService: GmailService): NodeJS.Timeout {
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
  const gmailService = new GmailService(env);

  try {
    await gmailService.init();

    const pubsubService = new PubsubService(env, gmailService);

    try {
      const handled = await gmailService.handlePendingMessages();
      if (!handled) {
        console.error('[Init] Pending messages handling completed with errors.');
      }
    } catch (error) {
      console.error('[Init] Error handling pending messages:', error);
    }

    await pubsubService.startListening();
    startPendingMessagesCronJob(gmailService);
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

void bootstrap();
