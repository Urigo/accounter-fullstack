import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { BUSINESS_SCOPE_HEADER, UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import { MAX_TOOL_RESULT_BYTES } from '../output.js';
import type { ToolDefinition } from '../registry.js';
import {
  DEFAULT_SECURITY_HOLDINGS,
  getSecurityExecutionsTool,
  listSecurityHoldingsTool,
  SECURITIES_CAVEATS,
} from '../securities.js';

const B1 = 'aa000000-0000-4000-8000-000000000001';
const B2 = 'aa000000-0000-4000-8000-000000000002';

function authContext(memberBusinessIds: string[] = [B1]): McpAuthContext {
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
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId: 'accountant' })),
  );
}

function clientReturning(data: unknown, capture?: (init: RequestInit) => void) {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    capture?.(init);
    return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
  });
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runTool = (tool: ToolDefinition<any>, client: UpstreamGraphQLClient, rawArgs: unknown, auth = authContext()) =>
  executeRegisteredTool({
    tool,
    rawArgs,
    auth,
    correlationId: 'c',
    client,
    authorization: 'Bearer t',
  });

const amount = (raw: number, currency: string) => ({
  raw,
  formatted: `${raw} ${currency}`,
  currency,
});

/**
 * Three securities chosen so ordering, search and currency grouping all have
 * something to bite on: a big USD position, a small USD one, and an ILS one whose
 * quantity is negative (a history that starts mid-life).
 */
function holdingsPayload() {
  return {
    securityHoldings: [
      {
        id: 'sb-small',
        security: {
          ownerId: B1,
          isin: 'US0378331005',
          symbol: 'AAPL',
          engName: 'Apple Inc',
          hebName: null,
          exchange: 'NASDAQ',
          currencyCode: 'USD',
          isEtf: false,
          identifiers: [{ type: 'POALIM_SECURITY_KEY', value: '5129523' }],
        },
        position: {
          quantity: 12,
          averageCost: amount(150, 'USD'),
          totalBought: amount(1800, 'USD'),
          totalSold: amount(0, 'USD'),
          historyStartDate: '2024-01-05',
          lastExecutionDate: '2026-05-01',
        },
      },
      {
        id: 'sb-big',
        security: {
          ownerId: B1,
          isin: 'US67066G1040',
          symbol: 'NVDA',
          engName: 'NVIDIA Corp',
          hebName: null,
          exchange: 'NASDAQ',
          currencyCode: 'USD',
          isEtf: false,
          identifiers: [{ type: 'POALIM_SECURITY_KEY', value: '1177423' }],
        },
        position: {
          quantity: 400,
          averageCost: amount(100, 'USD'),
          totalBought: amount(40_000, 'USD'),
          totalSold: amount(2500, 'USD'),
          historyStartDate: '2023-02-02',
          lastExecutionDate: '2026-06-01',
        },
      },
      {
        id: 'sb-negative',
        security: {
          ownerId: B2,
          isin: 'IL0010811143',
          symbol: 'TEVA',
          engName: null,
          hebName: 'טבע',
          exchange: 'TASE',
          currencyCode: 'ILS',
          isEtf: false,
          identifiers: [{ type: 'POALIM_SECURITY_KEY', value: '6290011' }],
        },
        position: {
          quantity: -80,
          averageCost: null,
          totalBought: null,
          totalSold: amount(9000, 'ILS'),
          historyStartDate: '2025-03-03',
          lastExecutionDate: '2026-01-01',
        },
      },
    ],
  };
}

interface HoldingsStructured {
  holdings: Array<{
    securityBusinessId: string;
    ownerId: string;
    isin: string;
    name: string;
    quantity: number;
    totalBought: { value: number; currency: string } | null;
  }>;
  byCurrency: Array<{
    currency: string;
    securityCount: number;
    totalBought: number;
    totalSold: number;
  }>;
  securitiesWithNoCurrency: number;
  caveats: readonly string[];
  totalCount: number;
  returnedCount: number;
  truncated: boolean;
  continuation?: { reason: string };
  scope: { memberBusinessIds: string[] };
}

describe('accounter_list_security_holdings', () => {
  it('orders by absolute quantity, so the biggest live position leads', async () => {
    const result = await runTool(listSecurityHoldingsTool, clientReturning(holdingsPayload()), {});
    const structured = result.structuredContent as unknown as HoldingsStructured;

    // 400, then |-80|, then 12 — the negative position sorts on its magnitude
    // rather than being pushed to the bottom by its sign.
    expect(structured.holdings.map(holding => holding.securityBusinessId)).toEqual([
      'sb-big',
      'sb-negative',
      'sb-small',
    ]);
  });

  it('tags every row with its owner, so a two-business answer is visible as one', async () => {
    const result = await runTool(
      listSecurityHoldingsTool,
      clientReturning(holdingsPayload()),
      {},
      authContext([B1, B2]),
    );
    const structured = result.structuredContent as unknown as HoldingsStructured;

    expect(structured.holdings.map(holding => holding.ownerId).sort()).toEqual([B1, B1, B2]);
    expect(structured.scope).toEqual({ memberBusinessIds: [B1, B2] });
  });

  it('forwards the resolved scope as x-business-scope', async () => {
    let seen: Record<string, string> | undefined;
    const client = clientReturning(holdingsPayload(), init => {
      seen = init.headers as Record<string, string>;
    });
    await runTool(listSecurityHoldingsTool, client, {}, authContext([B1, B2]));
    expect(seen?.[BUSINESS_SCOPE_HEADER]).toBe(`${B1},${B2}`);
  });

  it('narrows to a requested business', async () => {
    let seen: Record<string, string> | undefined;
    const client = clientReturning(holdingsPayload(), init => {
      seen = init.headers as Record<string, string>;
    });
    const result = await runTool(
      listSecurityHoldingsTool,
      client,
      { memberBusinessIds: [B2] },
      authContext([B1, B2]),
    );
    expect(seen?.[BUSINESS_SCOPE_HEADER]).toBe(B2);
    expect(
      (result.structuredContent as unknown as HoldingsStructured).scope.memberBusinessIds,
    ).toEqual([B2]);
  });

  it('rejects a business the caller is not a member of', async () => {
    const result = await runTool(listSecurityHoldingsTool, clientReturning(holdingsPayload()), {
      memberBusinessIds: ['aa000000-0000-4000-8000-000000000009'],
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });

  it.each([
    ['english name', 'nvidia', ['sb-big']],
    ['hebrew name', 'טבע', ['sb-negative']],
    ['symbol', 'aapl', ['sb-small']],
    ['isin', 'US67066G1040', ['sb-big']],
    ['exchange', 'tase', ['sb-negative']],
    ['currency', 'usd', ['sb-big', 'sb-small']],
    ['poalim security key', '6290011', ['sb-negative']],
  ])('searches by %s', async (_what, search, expected) => {
    const result = await runTool(listSecurityHoldingsTool, clientReturning(holdingsPayload()), {
      search,
    });
    const structured = result.structuredContent as unknown as HoldingsStructured;
    expect(structured.holdings.map(holding => holding.securityBusinessId)).toEqual(expected);
    expect(structured.totalCount).toBe(expected.length);
  });

  it('passes includeClosed through rather than filtering locally', async () => {
    let body: string | undefined;
    const client = clientReturning(holdingsPayload(), init => {
      body = init.body as string;
    });
    await runTool(listSecurityHoldingsTool, client, { includeClosed: true });
    expect(JSON.parse(body!).variables).toEqual({ includeClosed: true });
  });

  it('subtotals per currency and never across them', async () => {
    const result = await runTool(listSecurityHoldingsTool, clientReturning(holdingsPayload()), {});
    const structured = result.structuredContent as unknown as HoldingsStructured;

    expect(structured.byCurrency).toEqual([
      { currency: 'USD', securityCount: 2, totalBought: 41_800, totalSold: 2500 },
      { currency: 'ILS', securityCount: 1, totalBought: 0, totalSold: 9000 },
    ]);
    // No cross-currency total exists anywhere in the payload.
    expect(structured).not.toHaveProperty('totalBought');
  });

  it('counts securities with nothing ingested rather than bucketing them', async () => {
    const payload = holdingsPayload();
    payload.securityHoldings.push({
      id: 'sb-empty',
      security: {
        ownerId: B1,
        isin: 'US0000000000',
        symbol: null,
        engName: 'Never Traded',
        hebName: null,
        exchange: null,
        currencyCode: null,
        isEtf: false,
        identifiers: [],
      },
      position: {
        quantity: 0,
        averageCost: null,
        totalBought: null,
        totalSold: null,
        historyStartDate: null,
        lastExecutionDate: null,
      },
    } as (typeof payload.securityHoldings)[number]);

    const result = await runTool(listSecurityHoldingsTool, clientReturning(payload), {
      includeClosed: true,
    });
    const structured = result.structuredContent as unknown as HoldingsStructured;

    expect(structured.securitiesWithNoCurrency).toBe(1);
    expect(structured.byCurrency.map(bucket => bucket.currency)).toEqual(['USD', 'ILS']);
  });

  /**
   * The reference currency is known for a security nothing was ever traded of, so treating it as
   * evidence of an amount would put that security in a bucket with a 0/0 subtotal — the exact
   * null-means-nothing-ingested-not-zero confusion the caveats warn about.
   */
  it('does not bucket a security by its reference currency alone', async () => {
    const payload = holdingsPayload();
    payload.securityHoldings.push({
      id: 'sb-never-traded',
      security: {
        ownerId: B1,
        isin: 'US1111111111',
        symbol: 'NONE',
        engName: 'Never Traded',
        hebName: null,
        exchange: 'NASDAQ',
        // Known from the reference feed even though nothing was ever bought or sold.
        currencyCode: 'USD',
        isEtf: false,
        identifiers: [],
      },
      position: {
        quantity: 0,
        averageCost: null,
        totalBought: null,
        totalSold: null,
        historyStartDate: null,
        lastExecutionDate: null,
      },
    } as (typeof payload.securityHoldings)[number]);

    const result = await runTool(listSecurityHoldingsTool, clientReturning(payload), {
      includeClosed: true,
    });
    const structured = result.structuredContent as unknown as HoldingsStructured;

    expect(structured.securitiesWithNoCurrency).toBe(1);
    const usd = structured.byCurrency.find(bucket => bucket.currency === 'USD')!;
    // Still just the two securities that actually traded in USD.
    expect(usd.securityCount).toBe(2);
    expect(usd.totalBought).toBe(41_800);
  });

  it('trims the search, as the web screen does', async () => {
    const result = await runTool(listSecurityHoldingsTool, clientReturning(holdingsPayload()), {
      search: '  nvidia  ',
    });
    const structured = result.structuredContent as unknown as HoldingsStructured;
    expect(structured.holdings.map(holding => holding.securityBusinessId)).toEqual(['sb-big']);
  });

  it('treats an all-whitespace search as no search', async () => {
    const result = await runTool(listSecurityHoldingsTool, clientReturning(holdingsPayload()), {
      search: '   ',
    });
    expect((result.structuredContent as unknown as HoldingsStructured).totalCount).toBe(3);
  });

  it('falls back through the name to the ISIN, so a row is never nameless', async () => {
    const result = await runTool(listSecurityHoldingsTool, clientReturning(holdingsPayload()), {
      search: 'טבע',
    });
    const structured = result.structuredContent as unknown as HoldingsStructured;
    // No engName on this one, so the Hebrew name is used.
    expect(structured.holdings[0]!.name).toBe('טבע');
  });

  it('carries the caveats on the wire, not only in the description', async () => {
    const result = await runTool(listSecurityHoldingsTool, clientReturning(holdingsPayload()), {});
    const structured = result.structuredContent as unknown as HoldingsStructured;
    expect(structured.caveats).toEqual(SECURITIES_CAVEATS);
    expect(structured.caveats.join(' ')).toMatch(/never sum across currencies/i);
  });

  it('caps rows at the limit while reporting the full match count', async () => {
    const result = await runTool(listSecurityHoldingsTool, clientReturning(holdingsPayload()), {
      limit: 2,
    });
    const structured = result.structuredContent as unknown as HoldingsStructured;
    expect(structured.returnedCount).toBe(2);
    expect(structured.totalCount).toBe(3);
    expect(structured.truncated).toBe(true);
  });

  it('rejects a limit above the cap rather than silently clamping', async () => {
    const result = await runTool(listSecurityHoldingsTool, clientReturning(holdingsPayload()), {
      limit: 10_000,
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown input fields', async () => {
    const result = await runTool(listSecurityHoldingsTool, clientReturning(holdingsPayload()), {
      includeClosedPositions: true,
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  /**
   * The byte guard is what stands between a large portfolio and an invalid
   * response. A default-limit page of the widest plausible rows must still come
   * back as valid JSON with the shortfall declared.
   */
  it('degrades a large portfolio to valid JSON with a continuation hint', async () => {
    const securityHoldings = Array.from({ length: 400 }, (_unused, index) => ({
      id: `sb-${index}`.padEnd(36, '0'),
      security: {
        ownerId: B1,
        isin: `IL00108111${String(index).padStart(4, '0')}`,
        symbol: `SYMBOL${index}`,
        engName: `A Rather Long Security Name Number ${index}`,
        hebName: `שם ארוך של נייר ערך מספר ${index}`,
        exchange: 'NASDAQ',
        currencyCode: 'USD',
        isEtf: false,
        identifiers: [{ type: 'POALIM_SECURITY_KEY', value: String(1_000_000 + index) }],
      },
      position: {
        quantity: index + 1,
        averageCost: amount(123.456, 'USD'),
        totalBought: amount(98_765.43, 'USD'),
        totalSold: amount(1234.56, 'USD'),
        historyStartDate: '2023-01-01',
        lastExecutionDate: '2026-06-01',
      },
    }));

    const result = await runTool(
      listSecurityHoldingsTool,
      clientReturning({ securityHoldings }),
      {},
    );
    const structured = result.structuredContent as unknown as HoldingsStructured;

    expect(() => JSON.stringify(structured)).not.toThrow();
    expect(JSON.stringify(structured).length).toBeLessThanOrEqual(MAX_TOOL_RESULT_BYTES);
    expect(structured.totalCount).toBe(400);
    expect(structured.truncated).toBe(true);
    expect(structured.continuation?.reason).toBeTruthy();
    // The row cap bites before the byte guard does, so rows are dropped by the
    // limit rather than mid-object.
    expect(structured.returnedCount).toBeLessThanOrEqual(DEFAULT_SECURITY_HOLDINGS);
    // Subtotals describe every match, not just the returned page.
    expect(structured.byCurrency[0]!.securityCount).toBe(400);
  });
});

// ---------------------------------------------------------------------------

function executionsPayload(overrides: { totalRecords?: number; totalPages?: number } = {}) {
  return {
    securityExecutions: {
      pageInfo: {
        totalPages: overrides.totalPages ?? 3,
        totalRecords: overrides.totalRecords ?? 250,
      },
      nodes: [
        {
          securityBusiness: { id: 'sb-big', ownerId: B1, isin: 'US67066G1040', symbol: 'NVDA' },
          execution: {
            id: 'ex-2',
            tradeDate: '2026-06-01',
            valueDate: '2026-06-03',
            tradeType: 'SELL',
            transactionType: 'SELL',
            paymentType: null,
            quantity: 10,
            tradePrice: 250,
            netValue: amount(2500, 'USD'),
            tradeCommission: amount(5, 'USD'),
            israelTaxValue: amount(90, 'ILS'),
          },
        },
        {
          securityBusiness: { id: 'sb-big', ownerId: B1, isin: 'US67066G1040', symbol: 'NVDA' },
          execution: {
            id: 'ex-1',
            tradeDate: '2026-05-01',
            valueDate: '2026-05-03',
            tradeType: 'BUY',
            transactionType: 'BUY',
            paymentType: null,
            quantity: 10,
            tradePrice: 100,
            netValue: amount(-1000, 'USD'),
            tradeCommission: amount(5, 'USD'),
            israelTaxValue: null,
          },
        },
      ],
    },
  };
}

interface ExecutionsStructured {
  executions: Array<Record<string, unknown>>;
  pagination: { page: number; pageSize: number; totalPages: number; hasNextPage: boolean };
  caveats: readonly string[];
  totalCount: number;
  scope: { memberBusinessIds: string[] };
}

describe('accounter_get_security_executions', () => {
  const variablesOf = (body: string) => JSON.parse(body).variables;

  it('translates its 1-based page to the 0-based upstream page', async () => {
    let body: string | undefined;
    const client = clientReturning(executionsPayload(), init => {
      body = init.body as string;
    });
    await runTool(getSecurityExecutionsTool, client, { page: 3, pageSize: 100 });
    expect(variablesOf(body!).page).toBe(2);
    expect(variablesOf(body!).limit).toBe(100);
  });

  it('reports pagination in the tool 1-based terms', async () => {
    const result = await runTool(getSecurityExecutionsTool, clientReturning(executionsPayload()), {
      page: 2,
      pageSize: 100,
    });
    const structured = result.structuredContent as unknown as ExecutionsStructured;
    expect(structured.pagination).toEqual({
      page: 2,
      pageSize: 100,
      totalPages: 3,
      hasNextPage: true,
    });
    expect(structured.totalCount).toBe(250);
  });

  it('knows when it is on the last page', async () => {
    const result = await runTool(getSecurityExecutionsTool, clientReturning(executionsPayload()), {
      page: 3,
    });
    expect(
      (result.structuredContent as unknown as ExecutionsStructured).pagination.hasNextPage,
    ).toBe(false);
  });

  it('forwards the identity filters as a union, untouched', async () => {
    let body: string | undefined;
    const client = clientReturning(executionsPayload(), init => {
      body = init.body as string;
    });
    await runTool(getSecurityExecutionsTool, client, {
      isins: ['US67066G1040'],
      symbols: ['AAPL'],
      tradeTypes: ['SELL'],
      fromTradeDate: '2026-01-01',
      toTradeDate: '2026-12-31',
    });
    expect(variablesOf(body!).filters).toMatchObject({
      isins: ['US67066G1040'],
      symbols: ['AAPL'],
      tradeTypes: ['SELL'],
      fromTradeDate: '2026-01-01',
      toTradeDate: '2026-12-31',
    });
  });

  it('tags rows with the security and its owner', async () => {
    const result = await runTool(getSecurityExecutionsTool, clientReturning(executionsPayload()), {});
    const structured = result.structuredContent as unknown as ExecutionsStructured;
    expect(structured.executions[0]).toMatchObject({
      executionId: 'ex-2',
      securityBusinessId: 'sb-big',
      ownerId: B1,
      isin: 'US67066G1040',
      tradeType: 'SELL',
    });
  });

  it('omits the charge fields entirely when links were not requested', async () => {
    const result = await runTool(getSecurityExecutionsTool, clientReturning(executionsPayload()), {});
    const structured = result.structuredContent as unknown as ExecutionsStructured;
    // Absent, not null: "not asked for" must stay distinguishable from
    // "asked for, nothing matched".
    expect(structured.executions[0]).not.toHaveProperty('chargeId');
    expect(structured.executions[0]).not.toHaveProperty('transactionId');
  });

  it('reports a null chargeId when links were requested and nothing matched', async () => {
    const payload = executionsPayload();
    const nodes = payload.securityExecutions.nodes as Array<Record<string, unknown>>;
    nodes[0]!.charge = { id: 'charge-1' };
    nodes[0]!.transaction = { id: 'tx-1' };
    nodes[1]!.charge = null;
    nodes[1]!.transaction = null;

    const result = await runTool(getSecurityExecutionsTool, clientReturning(payload), {
      isins: ['US67066G1040'],
      includeCharges: true,
    });
    const structured = result.structuredContent as unknown as ExecutionsStructured;
    expect(structured.executions[0]).toMatchObject({ chargeId: 'charge-1', transactionId: 'tx-1' });
    expect(structured.executions[1]).toMatchObject({ chargeId: null, transactionId: null });
  });

  /**
   * Upstream also refuses this, but as an UPSTREAM_ERROR — which reads as a
   * transient server fault worth retrying, when the call was simply malformed.
   * Catching it here makes the failure say what to add.
   */
  it('refuses includeCharges without naming securities, as a validation error', async () => {
    const client = clientReturning(executionsPayload());
    const result = await runTool(getSecurityExecutionsTool, client, { includeCharges: true });
    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; message: string };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toMatch(/securityBusinessIds, isins or symbols/);
  });

  it.each([['securityBusinessIds'], ['isins'], ['symbols']])(
    'accepts includeCharges when %s names the securities',
    async field => {
      const result = await runTool(getSecurityExecutionsTool, clientReturning(executionsPayload()), {
        [field]: ['x'],
        includeCharges: true,
      });
      expect(result.isError).toBeUndefined();
    },
  );

  it('rejects an impossible calendar date that passes the format check', async () => {
    const result = await runTool(getSecurityExecutionsTool, clientReturning(executionsPayload()), {
      fromTradeDate: '2026-02-31',
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toMatch(/fromTradeDate/);
  });

  it('rejects an inverted date range', async () => {
    const result = await runTool(getSecurityExecutionsTool, clientReturning(executionsPayload()), {
      fromTradeDate: '2026-06-01',
      toTradeDate: '2026-01-01',
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toMatch(
      /on or before toTradeDate/,
    );
  });

  it('rejects a trade type outside the bank vocabulary', async () => {
    const result = await runTool(getSecurityExecutionsTool, clientReturning(executionsPayload()), {
      tradeTypes: ['SHORT_SELL'],
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('carries the caveats and the echoed scope', async () => {
    const result = await runTool(
      getSecurityExecutionsTool,
      clientReturning(executionsPayload()),
      {},
      authContext([B1, B2]),
    );
    const structured = result.structuredContent as unknown as ExecutionsStructured;
    expect(structured.caveats).toEqual(SECURITIES_CAVEATS);
    expect(structured.scope).toEqual({ memberBusinessIds: [B1, B2] });
  });

  it('reports an empty result without inventing a page', async () => {
    const result = await runTool(
      getSecurityExecutionsTool,
      clientReturning({
        securityExecutions: { pageInfo: { totalPages: 0, totalRecords: 0 }, nodes: [] },
      }),
      {},
    );
    const structured = result.structuredContent as unknown as ExecutionsStructured;
    expect(structured.totalCount).toBe(0);
    expect(structured.pagination.hasNextPage).toBe(false);
    expect(result.content[0]!.text).toMatch(/No executions matched/);
  });
});
