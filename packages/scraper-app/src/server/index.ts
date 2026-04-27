import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/healthz', async () => {
  return { ok: true };
});

try {
  await app.listen({ port: 3002, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
