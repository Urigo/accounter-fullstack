import { useGraphQLModules } from '@envelop/graphql-modules';
import { createServer } from '@graphql-yoga/node';
import fastify, { FastifyReply, FastifyRequest } from 'fastify';

import { createGraphQLApp } from './modules/app.mjs';

export async function buildApp(logging = true) {
  const app = fastify({
    logger: logging && {
      level: process.env.LOG_LEVEL || 'debug',
    },
  });

  const modulesApp = createGraphQLApp();

  const graphQLServer = createServer<{
    req: FastifyRequest;
    reply: FastifyReply;
  }>({
    logging: {
      debug: (...args) => args.forEach(arg => app.log.debug(arg)),
      info: (...args) => args.forEach(arg => app.log.info(arg)),
      warn: (...args) => args.forEach(arg => app.log.warn(arg)),
      error: (...args) => args.forEach(arg => app.log.error(arg)),
    },
    plugins: [useGraphQLModules(modulesApp)],
  });

  app.addContentTypeParser('multipart/form-data', {}, (req, payload, done) =>
    // TODO: implement for file uploads
    done(null)
  );

  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      const response = await graphQLServer.handleIncomingMessage(req, {
        req,
        reply,
      });
      response.headers.forEach((value, name) => {
        reply.header(name, value);
      });

      reply.status(response.status);

      reply.send(response.body);

      return reply;
    },
  });

  return app;
}
