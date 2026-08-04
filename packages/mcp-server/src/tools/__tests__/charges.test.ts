import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { MAX_DATE_RANGE_DAYS, MAX_PAGE_SIZE, searchChargesTool } from '../charges.js';
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
    // This fixture omits `owner` on purpose — it predates the field. Owner
    // tagging must degrade to nulls rather than throwing, so older fixtures and
    // any upstream that stops returning the field keep working.
    expect(structured.charges).toEqual([
      {
        id: 'c1',
        description: 'Coffee',
        ownerId: null,
        ownerName: null,
        amount: { value: 12.5, formatted: '₪12.50', currency: 'ILS' },
        date: '2026-01-05',
      },
    ]);
    expect(structured.totalCount).toBe(1);
    expect(structured.truncated).toBe(false);
    expect(structured.pagination.hasNextPage).toBe(false);
  });

  it('tags each charge with its owning business', async () => {
    const client = clientReturning({
      allCharges: {
        nodes: [
          {
            id: 'c1',
            userDescription: 'Coffee',
            owner: { id: 'b1', name: 'Acme' },
            totalAmount: { raw: 12.5, formatted: '₪12.50', currency: 'ILS' },
            minEventDate: '2026-01-05',
          },
        ],
        pageInfo: { totalPages: 1, totalRecords: 1, currentPage: 1, pageSize: 25 },
      },
    });
    const result = await run(client, authContext(['b1', 'b2']), {});

    const structured = result.structuredContent as {
      charges: Array<{ ownerId: string | null; ownerName: string | null }>;
      scope: { businessIds: string[] };
    };
    expect(structured.charges[0]).toMatchObject({ ownerId: 'b1', ownerName: 'Acme' });
    // The response echoes the effective scope, so a silent widening is visible.
    expect(structured.scope).toEqual({ businessIds: ['b1', 'b2'] });
    // …and the text content — what the model reads first — says so too.
    expect(result.content[0]!.text).toContain('across 2 businesses');
  });

  it('scopes the query to the authorized businesses (byOwners)', async () => {
    let sentBody: unknown;
    const client = clientReturning(oneCharge, body => (sentBody = body));
    await run(client, authContext(['b1', 'b2']), {});
    const variables = (sentBody as { variables: { filters: { byOwners: string[] } } }).variables;
    expect(variables.filters.byOwners).toEqual(['b1', 'b2']);
  });

  it('narrows the scope to a requested subset', async () => {
    let sentBody: unknown;
    const client = clientReturning(oneCharge, body => (sentBody = body));
    await run(client, authContext(['b1', 'b2', 'b3']), { businessIds: ['b2'] });
    const variables = (sentBody as { variables: { filters: { byOwners: string[] } } }).variables;
    expect(variables.filters.byOwners).toEqual(['b2']);
  });

  // Regression guard: `byBusinesses` is the COUNTERPARTY predicate, and upstream
  // strips the owner from `business_array`, so filtering by it returned only
  // inter-company charges. Owner scoping must never go back to that field.
  it('never sends byBusinesses — that is the counterparty predicate', async () => {
    let sentBody: unknown;
    const client = clientReturning(oneCharge, body => (sentBody = body));
    await run(client, authContext(['b1', 'b2']), {});
    const { filters } = (sentBody as { variables: { filters: Record<string, unknown> } }).variables;
    expect('byBusinesses' in filters).toBe(false);
  });

  // Regression guard for the "charges of June returned 6,672 rows from 2020"
  // report: the tool built the date bounds correctly, but nothing asserted they
  // reached upstream, so when `allCharges` silently ignored them the tool kept
  // looking healthy. Pin the forwarding here and the wiring server-side
  // (`allCharges` filter-forwarding test).
  //
  // The tool sends the `*AnyDate` pair deliberately. Upstream, `fromDate`/
  // `toDate` test the charge's primary window (`COALESCE(documents_min_date,
  // transactions_min_event_date)`), whereas `fromAnyDate`/`toAnyDate` test
  // whether the charge's span across *all* date sources — documents,
  // transaction event and debit, ledger invoice and value — overlaps the range
  // (`charges.provider.ts`). That is the broader, overlap semantic: "charges
  // active in this period", not "charges belonging to it".
  it('forwards the date range to upstream as the AnyDate pair', async () => {
    let sentBody: unknown;
    const client = clientReturning(oneCharge, body => (sentBody = body));
    await run(client, authContext(['b1']), { fromDate: '2026-06-01', toDate: '2026-06-30' });
    const { filters } = (
      sentBody as { variables: { filters: { fromAnyDate?: string; toAnyDate?: string } } }
    ).variables;
    expect(filters.fromAnyDate).toBe('2026-06-01');
    expect(filters.toAnyDate).toBe('2026-06-30');
  });

  // Guards the choice of predicate, not just that some date reached upstream:
  // sending the narrow pair would silently change which charges match.
  it('does not send the narrow fromDate/toDate pair', async () => {
    let sentBody: unknown;
    const client = clientReturning(oneCharge, body => (sentBody = body));
    await run(client, authContext(['b1']), { fromDate: '2026-06-01', toDate: '2026-06-30' });
    const { filters } = (sentBody as { variables: { filters: Record<string, unknown> } }).variables;
    expect('fromDate' in filters).toBe(false);
    expect('toDate' in filters).toBe(false);
  });

  it('omits date bounds that were not requested', async () => {
    let sentBody: unknown;
    const client = clientReturning(oneCharge, body => (sentBody = body));
    await run(client, authContext(['b1']), { fromDate: '2026-06-01' });
    const { filters } = (sentBody as { variables: { filters: Record<string, unknown> } }).variables;
    expect(filters.fromAnyDate).toBe('2026-06-01');
    // An absent bound must stay absent rather than become an explicit null —
    // upstream reads a missing upper bound as unbounded, which is what the
    // caller asked for.
    expect('toAnyDate' in filters).toBe(false);
  });

  // Upstream `allCharges` sorts ASCENDING when no `sortBy` is given, so an
  // unsorted request answers "show me charges" with the oldest rows in the
  // database. The tool must always ask for newest-first explicitly.
  it('requests newest-first ordering', async () => {
    let sentBody: unknown;
    const client = clientReturning(oneCharge, body => (sentBody = body));
    await run(client, authContext(['b1']), {});
    const { filters } = (
      sentBody as { variables: { filters: { sortBy?: { field: string; asc: boolean } } } }
    ).variables;
    expect(filters.sortBy).toEqual({ field: 'DATE', asc: false });
  });

  it('requests the first upstream page (0-based) for the default page', async () => {
    let sentBody: unknown;
    const client = clientReturning(oneCharge, body => (sentBody = body));
    await run(client, authContext(['b1']), {});
    const variables = (sentBody as { variables: { page: number } }).variables;
    expect(variables.page).toBe(0);
  });

  it('translates the 1-based page to the upstream 0-based page index', async () => {
    let sentBody: unknown;
    const client = clientReturning(oneCharge, body => (sentBody = body));
    await run(client, authContext(['b1']), { page: 2 });
    const variables = (sentBody as { variables: { page: number } }).variables;
    expect(variables.page).toBe(1);
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

  it('rejects a day-overflow date that Date.parse would silently roll over', async () => {
    const client = clientReturning(oneCharge);
    // 2026-02-31 is not a real date; Date.parse rolls it to March, so it must be
    // caught by explicit calendar validation, not just a NaN check.
    const result = await run(client, authContext(['b1']), { toDate: '2026-02-31' });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect((result.structuredContent as { message: string }).message).toBe('Invalid toDate');
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

  it('rejects a single impossible toDate that still matches the format', async () => {
    const client = clientReturning(oneCharge);
    const result = await run(client, authContext(['b1']), { toDate: '2026-13-01' });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toBe('Invalid toDate');
  });

  it('rejects a date range wider than the cap', async () => {
    const client = clientReturning(oneCharge);
    const fromDate = '2024-01-01';
    // One day beyond the cap, derived from the constant so the test tracks it.
    const toMs = Date.UTC(2024, 0, 1) + (MAX_DATE_RANGE_DAYS + 1) * 24 * 60 * 60 * 1000;
    const toDate = new Date(toMs).toISOString().slice(0, 10);
    const result = await run(client, authContext(['b1']), { fromDate, toDate });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toMatch(/must not exceed/);
  });

  it('rejects a page size above the cap', async () => {
    const client = clientReturning(oneCharge);
    const result = await run(client, authContext(['b1']), { pageSize: MAX_PAGE_SIZE + 1 });
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
