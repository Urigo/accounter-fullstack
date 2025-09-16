import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import 'reflect-metadata';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useHive } from '@graphql-hive/yoga';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { gmailConfig } from '@modules/common/helpers/gmail-listener/config.js';
import { GmailService } from '@modules/common/helpers/gmail-listener/gmail-service.js';
import { AccounterContext } from '@shared/types';
import { env } from './environment.js';
import { createGraphQLApp } from './modules-app.js';
import { adminContextPlugin } from './plugins/admin-context-plugin.js';
import { authPlugin } from './plugins/auth-plugin.js';
import { PubSubService } from '@modules/common/helpers/gmail-listener/pubsub-service.js';

const gmailService = new GmailService('accounter');
const pubsubService = new PubSubService('accounter');

async function main() {
  try {
    // Setup Gmail push notifications
      await gmailService.setupPushNotifications(gmailConfig.topicName);

      // Start listening to Pub/Sub
      await pubsubService.startListening();
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }

  const application = await createGraphQLApp(env);

  const yoga = createYoga({
    plugins: [
      authPlugin(),
      adminContextPlugin(),
      useGraphQLModules(application),
      useDeferStream(),
      useHive({
        enabled: !!env.hive,
        token: env.hive?.hiveToken ?? '',
        usage: !!env.hive,
      }),
    ],
    context: (yogaContext): AccounterContext => {
      return {
        ...yogaContext,
        env,
      };
    },
  });

  const server = createServer(yoga);

  server.listen(
    {
      port: 4000,
    },
    () => {
      console.log('GraphQL API located at http://localhost:4000/graphql');
    },
  );
}

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  // pubsubService.stopListening();
  process.exit(0);
});

main();
