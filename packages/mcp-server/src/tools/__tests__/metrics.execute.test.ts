import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { Metrics } from '../../observability/metrics.js';
import { RateLimiter } from '../../rate-limit/limiter.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { SEARCH_CHARGES_TOOL_NAME, searchChargesTool } from '../charges.js';
import { executeRegisteredTool } from '../execute.js';

function authContext(businessIds: string[] = ['b1']): McpAuthContext {
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
          data: {
            allCharges: {
              nodes: [],
              pageInfo: { totalPages: 0, totalRecords: 0, currentPage: 1, pageSize: 25 },
            },
          },
        }),
      }) as unknown as Response,
  );
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

describe('executeRegisteredTool — metrics', () => {
  it('records a success outcome and one latency observation', async () => {
    const metrics = new Metrics();
    const result = await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: {},
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
      metrics,
    });

    expect(result.isError).toBeUndefined();
    const snapshot = metrics.snapshot();
    expect(snapshot.requestsTotal[`${SEARCH_CHARGES_TOOL_NAME}|success`]).toBe(1);
    expect(snapshot.latencyMs.count).toBe(1);
  });

  it('records a validation_error outcome for bad input', async () => {
    const metrics = new Metrics();
    const result = await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: { unknownField: true },
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
      metrics,
    });

    expect(result.isError).toBe(true);
    expect(metrics.snapshot().requestsTotal[`${SEARCH_CHARGES_TOOL_NAME}|validation_error`]).toBe(1);
  });

  it('records a rate_limited outcome and bumps the rate-limited counter', async () => {
    const metrics = new Metrics();
    const limiter = new RateLimiter({ windowMs: 1000, max: 0 }, () => 0);
    const result = await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: {},
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
      limiter,
      metrics,
    });

    expect(result.isError).toBe(true);
    const snapshot = metrics.snapshot();
    expect(snapshot.requestsTotal[`${SEARCH_CHARGES_TOOL_NAME}|rate_limited`]).toBe(1);
    expect(snapshot.rateLimitedTotal).toBe(1);
  });

  it('is a no-op when no metrics registry is provided', async () => {
    const result = await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: {},
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
    });
    expect(result.isError).toBeUndefined();
  });
});
