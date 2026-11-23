import { createSchema, createYoga } from 'graphql-yoga';
import { describe, expect, it } from 'vitest';
import { CORS_PREFLIGHT_MAX_AGE_SECONDS, corsOptions } from '../cors.js';

const WEB_APP = 'https://www.accounter.tax';

const server = createYoga({
  schema: createSchema({ typeDefs: 'type Query { ok: Boolean }', resolvers: { Query: { ok: () => true } } }),
  cors: corsOptions,
  logging: false,
});

function preflight(method: string, headers: string) {
  return server.fetch('http://localhost/graphql', {
    method: 'OPTIONS',
    headers: {
      origin: WEB_APP,
      'access-control-request-method': method,
      'access-control-request-headers': headers,
    },
  });
}

describe('CORS', () => {
  it('lets the browser cache a preflight', async () => {
    const response = await preflight('POST', 'authorization,content-type,x-business-scope');

    expect(response.headers.get('access-control-max-age')).toBe(
      String(CORS_PREFLIGHT_MAX_AGE_SECONDS),
    );
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST');
  });

  it('keeps the default answer: the caller origin, its headers and credentials', async () => {
    const response = await preflight('GET', 'authorization,x-business-scope');

    expect(response.headers.get('access-control-allow-origin')).toBe(WEB_APP);
    expect(response.headers.get('access-control-allow-headers')).toBe(
      'authorization,x-business-scope',
    );
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('answers the request itself with the same origin', async () => {
    const response = await server.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { origin: WEB_APP, 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ ok }' }),
    });

    expect(response.headers.get('access-control-allow-origin')).toBe(WEB_APP);
    expect(await response.json()).toEqual({ data: { ok: true } });
  });
});
