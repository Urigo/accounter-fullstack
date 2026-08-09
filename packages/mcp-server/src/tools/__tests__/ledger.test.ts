import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import {
  DEFAULT_LEDGER_RECORDS,
  getLedgerRecordsTool,
  MAX_LEDGER_DATE_RANGE_DAYS,
  MAX_LEDGER_RECORDS,
} from '../ledger.js';

function authContext(memberBusinessIds: string[]): McpAuthContext {
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
    tool: getLedgerRecordsTool,
    rawArgs,
    auth,
    correlationId: 'corr-1',
    client,
    authorization: 'Bearer tok',
  });
}

const amount = (raw: number) => ({ raw, formatted: `₪${raw}`, currency: 'ILS' });

function record(id: string) {
  return {
    id,
    ownerId: 'b1',
    chargeId: 'charge-1',
    invoiceDate: '2026-01-05',
    valueDate: '2026-01-07',
    description: 'Coffee',
    reference: 'ref-1',
    debitAmount1: amount(12.5),
    debitAmount2: null,
    creditAmount1: amount(12.5),
    creditAmount2: null,
    localCurrencyDebitAmount1: amount(12.5),
    localCurrencyDebitAmount2: null,
    localCurrencyCreditAmount1: amount(12.5),
    localCurrencyCreditAmount2: null,
    debitAccount1: { id: 'fe1', name: 'Expenses' },
    debitAccount2: null,
    creditAccount1: { id: 'fe2', name: 'Bank' },
    creditAccount2: null,
  };
}

describe('getLedgerRecordsTool — successful read', () => {
  it('normalizes records into debit/credit entries carrying owner and charge ids', async () => {
    const client = clientReturning({ ledgerRecordsByFilters: [record('l1')] });
    const result = await run(client, authContext(['b1']), {});

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      ledgerRecords: Array<Record<string, unknown>>;
      totalCount: number;
      truncated: boolean;
    };
    expect(structured.ledgerRecords).toEqual([
      {
        id: 'l1',
        ownerId: 'b1',
        chargeId: 'charge-1',
        invoiceDate: '2026-01-05',
        valueDate: '2026-01-07',
        description: 'Coffee',
        reference: 'ref-1',
        debit1: {
          account: { id: 'fe1', name: 'Expenses' },
          amount: { value: 12.5, formatted: '₪12.5', currency: 'ILS' },
          localCurrencyAmount: { value: 12.5, formatted: '₪12.5', currency: 'ILS' },
        },
        debit2: { account: null, amount: null, localCurrencyAmount: null },
        credit1: {
          account: { id: 'fe2', name: 'Bank' },
          amount: { value: 12.5, formatted: '₪12.5', currency: 'ILS' },
          localCurrencyAmount: { value: 12.5, formatted: '₪12.5', currency: 'ILS' },
        },
        credit2: { account: null, amount: null, localCurrencyAmount: null },
      },
    ]);
    expect(structured.totalCount).toBe(1);
    expect(structured.truncated).toBe(false);
  });

  it('forwards every filter axis and scopes to the authorized businesses', async () => {
    let body: unknown;
    const client = clientReturning({ ledgerRecordsByFilters: [] }, captured => {
      body = captured;
    });
    await run(client, authContext(['b1', 'b2']), {
      fromInvoiceDate: '2026-01-01',
      toInvoiceDate: '2026-01-31',
      fromValueDate: '2026-02-01',
      toValueDate: '2026-02-28',
      fromDate: '2026-01-01',
      toDate: '2026-03-01',
      financialEntityIds: ['fe1'],
      financialEntityAccounts: ['DEBIT_ACCOUNT_1', 'CREDIT_ACCOUNT_2'],
      chargeIds: ['charge-1'],
      limit: 10,
    });

    const filters = (body as { variables: { filters: Record<string, unknown> } }).variables.filters;
    expect(filters).toEqual({
      // The tool's "any date" pair maps onto the upstream from/toAnyDate fields.
      fromAnyDate: '2026-01-01',
      toAnyDate: '2026-03-01',
      fromInvoiceDate: '2026-01-01',
      toInvoiceDate: '2026-01-31',
      fromValueDate: '2026-02-01',
      toValueDate: '2026-02-28',
      financialEntityIds: ['fe1'],
      financialEntityAccounts: ['DEBIT_ACCOUNT_1', 'CREDIT_ACCOUNT_2'],
      chargeIds: ['charge-1'],
      ownerIds: ['b1', 'b2'],
      // One extra row is requested so a full page can be reported as truncated.
      limit: 11,
    });
  });

  it('narrows ownerIds to the requested memberBusinessIds subset', async () => {
    let body: unknown;
    const client = clientReturning({ ledgerRecordsByFilters: [] }, captured => {
      body = captured;
    });
    await run(client, authContext(['b1', 'b2']), { memberBusinessIds: ['b2'] });

    const filters = (body as { variables: { filters: { ownerIds: string[] } } }).variables.filters;
    expect(filters.ownerIds).toEqual(['b2']);
  });

  it('reports truncation without leaking the probe row', async () => {
    const records = Array.from({ length: 4 }, (_, index) => record(`l${index}`));
    const client = clientReturning({ ledgerRecordsByFilters: records });
    const result = await run(client, authContext(['b1']), { limit: 3 });

    const structured = result.structuredContent as {
      ledgerRecords: unknown[];
      truncated: boolean;
      continuation?: { reason: string };
    };
    expect(structured.ledgerRecords).toHaveLength(3);
    expect(structured.truncated).toBe(true);
    expect(structured.continuation?.reason).toBe('result_cap');
  });

  it('defaults limit to the bounded page size', async () => {
    let body: unknown;
    const client = clientReturning({ ledgerRecordsByFilters: [] }, captured => {
      body = captured;
    });
    await run(client, authContext(['b1']), {});

    const filters = (body as { variables: { filters: { limit: number } } }).variables.filters;
    expect(filters.limit).toBe(DEFAULT_LEDGER_RECORDS + 1);
  });
});

describe('getLedgerRecordsTool — input validation', () => {
  it.each([
    ['invoice', { fromInvoiceDate: '2026-03-01', toInvoiceDate: '2026-01-01' }],
    ['value', { fromValueDate: '2026-03-01', toValueDate: '2026-01-01' }],
    ['any', { fromDate: '2026-03-01', toDate: '2026-01-01' }],
  ])('rejects an inverted %s date range', async (_axis, rawArgs) => {
    const result = await run(clientReturning({}), authContext(['b1']), rawArgs);
    expect(result.isError).toBe(true);
  });

  it('rejects an impossible calendar date that matches the format', async () => {
    const result = await run(clientReturning({}), authContext(['b1']), {
      fromInvoiceDate: '2026-02-31',
    });
    expect(result.isError).toBe(true);
  });

  it(`rejects a range wider than ${MAX_LEDGER_DATE_RANGE_DAYS} days`, async () => {
    const result = await run(clientReturning({}), authContext(['b1']), {
      fromDate: '2020-01-01',
      toDate: '2026-01-01',
    });
    expect(result.isError).toBe(true);
  });

  it(`rejects a limit above ${MAX_LEDGER_RECORDS}`, async () => {
    const result = await run(clientReturning({}), authContext(['b1']), {
      limit: MAX_LEDGER_RECORDS + 1,
    });
    expect(result.isError).toBe(true);
  });

  it('rejects an unknown account slot', async () => {
    const result = await run(clientReturning({}), authContext(['b1']), {
      financialEntityAccounts: ['DEBIT_ACCOUNT_3'],
    });
    expect(result.isError).toBe(true);
  });

  it('rejects an out-of-scope memberBusinessId', async () => {
    const result = await run(clientReturning({}), authContext(['b1']), {
      memberBusinessIds: ['not-mine'],
    });
    expect(result.isError).toBe(true);
  });
});
