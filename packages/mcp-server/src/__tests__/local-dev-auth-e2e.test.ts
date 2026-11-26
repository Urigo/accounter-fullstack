import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Local dev-auth mode, end to end: the real MCP HTTP server and the real upstream client, against
 * a fake GraphQL upstream on a loopback socket that records the headers it receives.
 *
 * Pins that, with MCP_LOCAL_DEV_AUTH_USER_ID set, a request with no bearer token is served as
 * that user, that every upstream call carries X-Dev-Auth and never Authorization (even when the
 * caller sent one), and that the Auth0 verifier is never consulted.
 */

const verifyAccessToken = vi.fn(async () => {
  throw new Error('the Auth0 verifier must not run in local dev-auth mode');
});
vi.mock('../auth/verifier.js', () => ({ verifyAccessToken }));

const USER_ID = '1bb10fc7-90de-5fe9-9e2a-102fb80b9bee';
const BUSINESS_ID = 'e98dc777-a472-51a5-a834-3cba59409987';

const upstreamRequests: { headers: IncomingHttpHeaders; query: string }[] = [];
let upstream: Server;
let mcp: Server;
let mcpUrl: string;

function listen(server: Server): Promise<number> {
  return new Promise(resolve =>
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)),
  );
}

beforeAll(async () => {
  upstream = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const { query } = JSON.parse(body) as { query: string };
      upstreamRequests.push({ headers: req.headers, query });
      const authorized = req.headers['x-dev-auth'] === USER_ID;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify(
          authorized && query.includes('myMemberships')
            ? {
                data: {
                  myMemberships: [
                    { businessId: BUSINESS_ID, roleId: 'business_owner', businessName: 'Local Co' },
                  ],
                },
              }
            : {
                data: null,
                errors: [{ message: 'Authentication required', extensions: { code: 'UNAUTHENTICATED' } }],
              },
        ),
      );
    });
  });
  const upstreamPort = await listen(upstream);

  vi.stubEnv('MCP_PUBLIC_BASE_URL', 'http://localhost:3100');
  vi.stubEnv('AUTH0_ISSUER_URL', 'https://tenant.auth0.com/');
  vi.stubEnv('AUTH0_AUDIENCE', 'mcp-api');
  vi.stubEnv('GRAPHQL_UPSTREAM_URL', `http://127.0.0.1:${upstreamPort}/graphql`);
  vi.stubEnv('MCP_ENABLED', '1');
  vi.stubEnv('MCP_LOCAL_DEV_AUTH_USER_ID', USER_ID);
  const { resetEnvCache } = await import('../config/env.js');
  const { resetUpstreamClient } = await import('../upstream/default-client.js');
  resetEnvCache();
  resetUpstreamClient();

  const { createHttpServer } = await import('../server.js');
  mcp = createHttpServer();
  mcpUrl = `http://127.0.0.1:${await listen(mcp)}/mcp`;
});

afterAll(async () => {
  await Promise.all(
    [mcp, upstream].map(
      server => new Promise<void>(resolve => server.close(() => resolve())),
    ),
  );
  const { resetEnvCache } = await import('../config/env.js');
  const { resetUpstreamClient } = await import('../upstream/default-client.js');
  vi.unstubAllEnvs();
  resetEnvCache();
  resetUpstreamClient();
});

async function callTool(name: string, headers: Record<string, string> = {}) {
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: {} },
    }),
  });
  return { status: res.status, body: (await res.json()) as { result?: Record<string, unknown> } };
}

describe('local dev-auth mode', () => {
  it('serves a request without a bearer token as the configured user', async () => {
    const { status, body } = await callTool('accounter_list_business_memberships');

    expect(status).toBe(200);
    expect(body.result?.isError).not.toBe(true);
    expect(JSON.stringify(body.result)).toContain(BUSINESS_ID);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('sends X-Dev-Auth upstream and never forwards the caller’s Authorization', async () => {
    upstreamRequests.length = 0;
    await callTool('accounter_list_business_memberships', {
      authorization: 'Bearer caller-token',
    });

    expect(upstreamRequests.length).toBeGreaterThan(0);
    for (const request of upstreamRequests) {
      expect(request.headers['x-dev-auth']).toBe(USER_ID);
      expect(request.headers.authorization).toBeUndefined();
    }
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });
});
