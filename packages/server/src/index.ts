import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import 'reflect-metadata';
import { useGraphQLModules } from '@envelop/graphql-modules';
import { useHive } from '@graphql-hive/yoga';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { AccounterContext } from '@shared/types';
import { env } from './environment.js';
import { GmailService } from './gmail-listener/gmail-service.js';
import { PubSubService } from './gmail-listener/pubsub-service.js';
import { createGraphQLApp } from './modules-app.js';
import { adminContextPlugin } from './plugins/admin-context-plugin.js';
import { authPlugin } from './plugins/auth-plugin.js';

const gmailService = env.gmail ? new GmailService(env.gmail) : null;
const pubsubService = env.gmail && gmailService ? new PubSubService(env.gmail, gmailService) : null;

async function main() {
  try {
    // Setup Gmail labels and push notifications
    await gmailService?.init();

    // Start listening to Pub/Sub
    await pubsubService?.startListening();
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
        gmail: env.gmail
          ? {
              gmailService: gmailService!,
              pubsubService: pubsubService!,
            }
          : undefined,
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
  pubsubService?.stopListening();
  process.exit(0);
});

main();
