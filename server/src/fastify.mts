import { createServer } from '@graphql-yoga/node';
import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { getSchema } from './schema.mjs';

export async function buildApp(logging = true) {
  const app = fastify({
    logger: logging && {
      transport: {
        target: 'pino-pretty',
      },
      level: 'debug',
    },
  });

  const schema = await getSchema();

  const graphQLServer = createServer<{
    req: FastifyRequest;
    reply: FastifyReply;
  }>({
    schema,
    // Integrate Fastify Logger to Yoga
    logging: {
      debug: (...args) => args.forEach(arg => app.log.debug(arg)),
      info: (...args) => args.forEach(arg => app.log.info(arg)),
      warn: (...args) => args.forEach(arg => app.log.warn(arg)),
      error: (...args) => args.forEach(arg => app.log.error(arg)),
    },
  });

  //   app.addContentTypeParser('multipart/form-data', {}, (req, payload, done) =>
  //     done(null),
  //   )

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
