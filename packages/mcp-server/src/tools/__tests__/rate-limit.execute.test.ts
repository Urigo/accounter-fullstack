import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { RateLimiter } from '../../rate-limit/limiter.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { searchChargesTool } from '../charges.js';
import { executeRegisteredTool } from '../execute.js';

function authContext(businessIds: string[]): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes: [],
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(
    principal,
    businessIds.map(businessId => ({ businessId, roleId: 'accountant' })),
  );
}

function client() {
  const fetchImpl = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          data: { allCharges: { nodes: [], pageInfo: { totalPages: 0, totalRecords: 0, currentPage: 1, pageSize: 25 } } },
        }),
      }) as unknown as Response,
  );
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

function run(limiter: RateLimiter, auth: McpAuthContext) {
  return executeRegisteredTool({
    tool: searchChargesTool,
    rawArgs: {},
    auth,
    correlationId: 'corr-1',
    client: client(),
    authorization: 'Bearer tok',
    limiter,
  });
}

describe('executeRegisteredTool — rate limiting', () => {
  it('allows within the limit, then returns RATE_LIMIT_ERROR', async () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 2 }, () => 0);
    const auth = authContext(['b1']);

    expect((await run(limiter, auth)).isError).toBeUndefined();
    expect((await run(limiter, auth)).isError).toBeUndefined();

    const limited = await run(limiter, auth);
    expect(limited.isError).toBe(true);
    const structured = limited.structuredContent as { code: string; retryable: boolean; retryAfterMs: number };
    expect(structured.code).toBe('RATE_LIMIT_ERROR');
    expect(structured.retryable).toBe(true);
    expect(structured.retryAfterMs).toBe(1000);
  });

  it('keys the limit by tool + business scope (different scope is independent)', async () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 }, () => 0);
    expect((await run(limiter, authContext(['b1']))).isError).toBeUndefined();
    // Same user + tool but a different business scope → separate bucket.
    expect((await run(limiter, authContext(['b2']))).isError).toBeUndefined();
    // Repeat of the first scope is now limited.
    expect((await run(limiter, authContext(['b1']))).isError).toBe(true);
  });
});
