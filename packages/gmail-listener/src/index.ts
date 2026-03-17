import { env } from './environment.js';
import { GmailService } from './gmail-service.js';
import { PubsubService } from './pubsub-service.js';

async function init() {
  const gmailService = new GmailService(env);

  await gmailService.init();

  const pubsubService = new PubsubService(env, gmailService);

  gmailService.handlePendingMessages();
  await pubsubService.startListening();
}

init();
