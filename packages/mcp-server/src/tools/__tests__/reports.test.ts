import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import { balanceReportTool, MAX_REPORT_ROWS } from '../reports.js';

function authContext(businessIds: string[], roles: string[] = ['accountant']): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes: roles,
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(
    principal,
    businessIds.map(businessId => ({ businessId, roleId: 'accountant' })),
  );
}

function clientReturning(rows: unknown[], capture?: (body: unknown) => void) {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    capture?.(JSON.parse(init.body as string));
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { transactionsForBalanceReport: rows } }),
    } as unknown as Response;
  });
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

function row(id: string) {
  return {
    id,
    chargeId: `charge-${id}`,
    date: '2026-01-05',
    isFee: false,
    description: 'x',
    amount: { raw: 10, formatted: '₪10', currency: 'ILS' },
  };
}

const run = (client: UpstreamGraphQLClient, auth: McpAuthContext, rawArgs: unknown) =>
  executeRegisteredTool({
    tool: balanceReportTool,
    rawArgs,
    auth,
    correlationId: 'c',
    client,
    authorization: 'Bearer t',
  });

const validArgs = { businessId: 'b1', fromDate: '2026-01-01', toDate: '2026-03-01' };

describe('balanceReportTool — valid report', () => {
  it('returns normalized rows scoped to the requested business (ownerId)', async () => {
    let sent: unknown;
    const client = clientReturning([row('t1')], body => (sent = body));
    const result = await run(client, authContext(['b1', 'b2']), validArgs);

    expect(result.isError).toBeUndefined();
    expect((sent as { variables: { ownerId: string } }).variables.ownerId).toBe('b1');
    const structured = result.structuredContent as {
      rows: unknown[];
      totalCount: number;
      businessId: string;
    };
    expect(structured.businessId).toBe('b1');
    expect(structured.totalCount).toBe(1);
    expect(structured.rows).toEqual([
      {
        id: 't1',
        chargeId: 'charge-t1',
        date: '2026-01-05',
        isFee: false,
        description: 'x',
        amount: { value: 10, formatted: '₪10', currency: 'ILS' },
      },
    ]);
  });
});

describe('balanceReportTool — invalid range', () => {
  it('rejects an inverted date range', async () => {
    const client = clientReturning([]);
    const result = await run(client, authContext(['b1']), {
      businessId: 'b1',
      fromDate: '2026-03-01',
      toDate: '2026-01-01',
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('rejects a range wider than the cap', async () => {
    const client = clientReturning([]);
    const result = await run(client, authContext(['b1']), {
      businessId: 'b1',
      fromDate: '2024-01-01',
      toDate: '2026-01-01',
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toMatch(/must not exceed/);
  });

  it('rejects a bad date format', async () => {
    const client = clientReturning([]);
    const result = await run(client, authContext(['b1']), {
      businessId: 'b1',
      fromDate: '2026/01/01',
      toDate: '2026-02-01',
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });
});

describe('balanceReportTool — oversized results', () => {
  it('caps rows at MAX_REPORT_ROWS and flags truncation', async () => {
    const many = Array.from({ length: MAX_REPORT_ROWS + 5 }, (_, i) => row(`t${i}`));
    const client = clientReturning(many);
    const result = await run(client, authContext(['b1']), validArgs);
    const structured = result.structuredContent as {
      rows: unknown[];
      totalCount: number;
      truncated: boolean;
    };
    // The in-tool row cap bounds items before serialization; the shared
    // payload guard may trim further. Either way the result is truncated and
    // reports the true upstream total.
    expect(structured.rows.length).toBeGreaterThan(0);
    expect(structured.rows.length).toBeLessThanOrEqual(MAX_REPORT_ROWS);
    expect(structured.totalCount).toBe(MAX_REPORT_ROWS + 5);
    expect(structured.truncated).toBe(true);
  });
});

describe('balanceReportTool — authorization', () => {
  it('denies a caller without the required role', async () => {
    const client = clientReturning([]);
    const result = await run(client, authContext(['b1'], ['read:charges']), validArgs);
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });

  it('denies a business outside the caller memberships', async () => {
    const client = clientReturning([]);
    const result = await run(client, authContext(['b2']), validArgs);
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });
});
