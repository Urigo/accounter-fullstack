import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
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

function clientReturning(data: unknown, capture?: (body: unknown) => void) {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    capture?.(JSON.parse(init.body as string));
    return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
  });
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

function run(client: UpstreamGraphQLClient, auth: McpAuthContext, rawArgs: unknown) {
  return executeRegisteredTool({
    tool: searchChargesTool,
    rawArgs,
    auth,
    correlationId: 'corr-1',
    client,
    authorization: 'Bearer tok',
  });
}

const oneCharge = {
  allCharges: {
    nodes: [
      {
        id: 'c1',
        userDescription: 'Coffee',
        totalAmount: { raw: 12.5, formatted: '₪12.50', currency: 'ILS' },
        minEventDate: '2026-01-05',
      },
    ],
    pageInfo: { totalPages: 1, totalRecords: 1, currentPage: 1, pageSize: 25 },
  },
};

describe('searchChargesTool — successful read', () => {
  it('normalizes charges and pagination', async () => {
    const client = clientReturning(oneCharge);
    const result = await run(client, authContext(['b1']), { fromDate: '2026-01-01' });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      charges: Array<{ id: string; amount: { value: number } | null }>;
      pagination: { hasNextPage: boolean };
      totalCount: number;
      truncated: boolean;
    };
    expect(structured.charges).toEqual([
      {
        id: 'c1',
        description: 'Coffee',
        amount: { value: 12.5, formatted: '₪12.50', currency: 'ILS' },
        date: '2026-01-05',
      },
    ]);
    expect(structured.totalCount).toBe(1);
    expect(structured.truncated).toBe(false);
    expect(structured.pagination.hasNextPage).toBe(false);
  });

  it('scopes the query to the authorized businesses (byBusinesses)', async () => {
    let sentBody: unknown;
    const client = clientReturning(oneCharge, body => (sentBody = body));
    await run(client, authContext(['b1', 'b2']), {});
    const variables = (sentBody as { variables: { filters: { byBusinesses: string[] } } }).variables;
    expect(variables.filters.byBusinesses).toEqual(['b1', 'b2']);
  });

  it('narrows the scope to a requested subset', async () => {
    let sentBody: unknown;
    const client = clientReturning(oneCharge, body => (sentBody = body));
    await run(client, authContext(['b1', 'b2', 'b3']), { businessIds: ['b2'] });
    const variables = (sentBody as { variables: { filters: { byBusinesses: string[] } } }).variables;
    expect(variables.filters.byBusinesses).toEqual(['b2']);
  });
});

describe('searchChargesTool — empty results', () => {
  it('reports no matches', async () => {
    const client = clientReturning({
      allCharges: {
        nodes: [],
        pageInfo: { totalPages: 0, totalRecords: 0, currentPage: 1, pageSize: 25 },
      },
    });
    const result = await run(client, authContext(['b1']), {});
    expect(result.isError).toBeUndefined();
    expect((result.structuredContent as { charges: unknown[] }).charges).toEqual([]);
    expect(result.content[0].text).toMatch(/No charges/);
  });
});

describe('searchChargesTool — invalid filters', () => {
  it('rejects an unknown field (VALIDATION_ERROR)', async () => {
    const client = clientReturning(oneCharge);
    const result = await run(client, authContext(['b1']), { bogus: true });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('rejects a bad date format', async () => {
    const client = clientReturning(oneCharge);
    const result = await run(client, authContext(['b1']), { fromDate: '01/01/2026' });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('rejects a single impossible date that still matches the format', async () => {
    const client = clientReturning(oneCharge);
    // Passes the regex but is an impossible calendar date; only fromDate given.
    const result = await run(client, authContext(['b1']), { fromDate: '2026-13-01' });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toBe('Invalid fromDate');
  });

  it('rejects an inverted date range', async () => {
    const client = clientReturning(oneCharge);
    const result = await run(client, authContext(['b1']), {
      fromDate: '2026-02-01',
      toDate: '2026-01-01',
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toMatch(/on or before/);
  });

  it('rejects a page size above the cap', async () => {
    const client = clientReturning(oneCharge);
    const result = await run(client, authContext(['b1']), { pageSize: 500 });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });
});

describe('searchChargesTool — scope enforcement', () => {
  it('denies a requested business outside the memberships (AUTHORIZATION_ERROR)', async () => {
    const client = clientReturning(oneCharge);
    const result = await run(client, authContext(['b1']), { businessIds: ['bX'] });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });

  it('denies a caller with no business memberships', async () => {
    const client = clientReturning(oneCharge);
    const result = await run(client, authContext([]), {});
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });
});

describe('searchChargesTool — upstream failure', () => {
  it('maps an upstream error to a retryable UPSTREAM/TIMEOUT result', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response);
    const client = new UpstreamGraphQLClient({
      endpoint: 'http://localhost:4000/graphql',
      timeoutMs: 1000,
      maxRetries: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await run(client, authContext(['b1']), {});
    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; retryable: boolean };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.retryable).toBe(true);
  });
});
