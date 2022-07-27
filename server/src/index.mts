import './polyfills.mjs';

import { buildApp } from './fastify.mjs';

async function main() {
  const app = await buildApp(true);

  app
    .listen({
      port: 4000,
    })
    .then(serverUrl => {
      app.log.info(`GraphQL API located at ${serverUrl}/graphql`);
    })
    .catch(err => {
      app.log.error(err);
      process.exit(1);
    });
}

main();
