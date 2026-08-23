/**
 * The SPA fallback must not answer anything but a browser navigation.
 *
 * `reply.sendFile` responds with a 200, so a catch-all that also caught API calls and
 * non-GET verbs turned a mistyped URL into HTML-with-a-200. That is how pointing the
 * vault's `serverUrl` at this app instead of the Accounter server surfaced as
 * "Invalid execution result: result is not object or array" out of graphql-request,
 * rather than as a plain 404.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../index.js';

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildServer();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('SPA fallback', () => {
  it('404s a POST to an unknown path instead of serving the SPA', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: '{ __typename }' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('<!doctype');
    expect(res.json()).toMatchObject({ error: 'not-found', method: 'POST', url: '/graphql' });
  });

  it('404s an unknown /api path rather than serving the SPA', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });

    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('<!doctype');
    expect(res.json()).toMatchObject({ error: 'not-found', url: '/api/nope' });
  });

  it('still routes requests that do match a route', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
