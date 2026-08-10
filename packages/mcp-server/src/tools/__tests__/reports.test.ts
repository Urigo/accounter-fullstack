import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import { balanceReportTool, MAX_REPORT_DATE_RANGE_DAYS, MAX_REPORT_ROWS } from '../reports.js';

/**
 * The caller's business role is the membership `roleId` resolved upstream — the
 * token carries identity plus coarse transport scopes only (spec §6.4/§7.1).
 */
function authContext(memberBusinessIds: string[], roleId = 'accountant'): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes: ['openid'],
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(
    principal,
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId })),
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

const validArgs = { memberBusinessId: 'b1', fromDate: '2026-01-01', toDate: '2026-03-01' };

describe('balanceReportTool — valid report', () => {
  // Regression guard for the owner source. Driven through the handler directly
  // rather than `executeRegisteredTool`, because the policy narrows `readScope`
  // to exactly `[input.memberBusinessId]` (execute.ts honors the singular field), so
  // via the normal path the scope-derived owner and the requested owner always
  // agree and the two are indistinguishable.
  //
  // The bug is therefore latent, not live — but it goes live the moment the
  // resolved scope can hold more than one business, at which point deriving the
  // owner from `readScope.memberBusinessIds[0]` silently reports on the wrong one.
  it('takes the owner from input.memberBusinessId, not from the first id in scope', async () => {
    let sent: unknown;
    const client = clientReturning([row('t1')], body => (sent = body));
    const auth = authContext(['b1', 'b2']);
    const result = await balanceReportTool.handler(
      { memberBusinessId: 'b2', fromDate: '2026-01-01', toDate: '2026-03-01', reportType: 'BALANCE' },
      {
        auth,
        // Deliberately wider than one business, and ordered so that
        // `memberBusinessIds[0]` is NOT the requested business.
        readScope: { memberBusinessIds: ['b1', 'b2'] },
        correlationId: 'c',
        client,
        authorization: 'Bearer t',
        upstream: { correlationId: 'c', authorization: 'Bearer t', businessScope: ['b1', 'b2'] },
      },
    );

    expect(result.isError).toBeUndefined();
    expect((sent as { variables: { ownerId: string } }).variables.ownerId).toBe('b2');
    expect((result.structuredContent as { memberBusinessId: string }).memberBusinessId).toBe('b2');
  });

  it('returns normalized rows scoped to the requested business (ownerId)', async () => {
    let sent: unknown;
    const client = clientReturning([row('t1')], body => (sent = body));
    const result = await run(client, authContext(['b1', 'b2']), validArgs);

    expect(result.isError).toBeUndefined();
    expect((sent as { variables: { ownerId: string } }).variables.ownerId).toBe('b1');
    const structured = result.structuredContent as {
      rows: unknown[];
      totalCount: number;
      memberBusinessId: string;
    };
    expect(structured.memberBusinessId).toBe('b1');
    expect(structured.totalCount).toBe(1);
    expect(structured.rows).toEqual([
      {
        id: 't1',
        chargeId: 'charge-t1',
        // The report runs for exactly one business, but the row still names it —
        // a caller merging reports across their memberships can group by it.
        ownerId: 'b1',
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
      memberBusinessId: 'b1',
      fromDate: '2026-03-01',
      toDate: '2026-01-01',
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('rejects a range wider than the cap', async () => {
    const client = clientReturning([]);
    // One day beyond the cap, derived from the constant so the test tracks it.
    const toMs = Date.UTC(2024, 0, 1) + (MAX_REPORT_DATE_RANGE_DAYS + 1) * 24 * 60 * 60 * 1000;
    const toDate = new Date(toMs).toISOString().slice(0, 10);
    const result = await run(client, authContext(['b1']), {
      memberBusinessId: 'b1',
      fromDate: '2024-01-01',
      toDate,
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toMatch(/must not exceed/);
  });

  it('rejects a bad date format', async () => {
    const client = clientReturning([]);
    const result = await run(client, authContext(['b1']), {
      memberBusinessId: 'b1',
      fromDate: '2026/01/01',
      toDate: '2026-02-01',
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('rejects an impossible date that still matches the format', async () => {
    const client = clientReturning([]);
    // Passes the schema's format regex but is not a real calendar date, so the
    // handler's own Date.parse guard (not zod) must reject it.
    const result = await run(client, authContext(['b1']), {
      memberBusinessId: 'b1',
      fromDate: '2026-13-01',
      toDate: '2026-03-01',
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toBe(
      'Invalid fromDate/toDate',
    );
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
    const result = await run(client, authContext(['b1'], 'viewer'), validArgs);
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
