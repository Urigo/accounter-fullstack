import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { listAccountsTool } from '../accounts.js';
import { executeRegisteredTool } from '../execute.js';
import {
  incomeExpenseSummaryTool,
  MAX_AGGREGATE_RANGE_DAYS,
  profitAndLossTool,
  vatReportTool,
} from '../financial-reports.js';
import { counterpartyTotalsTool, ledgerRecordsTool } from '../ledger-reports.js';
import type { ToolDefinition } from '../registry.js';

/**
 * Unit coverage for the Phase 2 report tools. Mirrors the harness in
 * `detail-tools.test.ts`: a fake upstream returns fixtures and the executor
 * drives validation + policy + handler.
 */

const B1 = 'aa000000-0000-4000-8000-000000000001';
const B2 = 'aa000000-0000-4000-8000-000000000002';

function authContext(businessIds: string[], roleId = 'business_owner'): McpAuthContext {
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
    businessIds.map(businessId => ({ businessId, roleId })),
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

function run(
  tool: ToolDefinition,
  client: UpstreamGraphQLClient,
  auth: McpAuthContext,
  rawArgs: unknown,
) {
  return executeRegisteredTool({
    tool,
    rawArgs,
    auth,
    correlationId: 'corr-1',
    client,
    authorization: 'Bearer tok',
  });
}

const ils = (raw: number) => ({ raw, formatted: `₪${raw}`, currency: 'ILS' });

// ---------------------------------------------------------------------------
// list_accounts
// ---------------------------------------------------------------------------

describe('listAccountsTool', () => {
  const fixture = {
    financialAccountsByOwner: [
      {
        __typename: 'BankFinancialAccount',
        id: 'acc1',
        name: 'Poalim ILS',
        number: '12345',
        type: 'BANK_ACCOUNT',
        privateOrBusiness: 'BUSINESS',
        accountTaxCategories: [{ currency: 'ILS' }, { currency: 'USD' }, { currency: 'ILS' }],
        bankNumber: 12,
        branchNumber: 345,
        iban: 'IL123',
        swiftCode: 'POALILIT',
      },
      {
        __typename: 'CardFinancialAccount',
        id: 'acc2',
        name: 'Isracard',
        number: '9999',
        type: 'CREDIT_CARD',
        privateOrBusiness: 'BUSINESS',
        accountTaxCategories: [],
        fourDigits: '9999',
      },
    ],
  };

  it('normalizes accounts with their type-specific identifiers', async () => {
    const client = clientReturning(fixture);
    const result = await run(listAccountsTool, client, authContext([B1]), { businessId: B1 });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      accounts: Array<Record<string, unknown>>;
      countsByType: Record<string, number>;
    };
    expect(structured.accounts[0]).toMatchObject({
      id: 'acc1',
      type: 'BANK_ACCOUNT',
      // De-duplicated and sorted.
      currencies: ['ILS', 'USD'],
      bank: { bankNumber: 12, branchNumber: 345, iban: 'IL123' },
      cardLastFour: null,
    });
    expect(structured.accounts[1]).toMatchObject({
      id: 'acc2',
      type: 'CREDIT_CARD',
      bank: null,
      cardLastFour: '9999',
    });
    expect(structured.countsByType).toEqual({ BANK_ACCOUNT: 1, CREDIT_CARD: 1 });
  });

  // Balances are deliberately absent: upstream stores a placeholder 0 for cards,
  // deposits and SWIFT rows, so any balance we reported would be wrong more
  // often than right.
  it('never reports a balance', async () => {
    const client = clientReturning(fixture);
    const result = await run(listAccountsTool, client, authContext([B1]), { businessId: B1 });
    const { accounts } = result.structuredContent as { accounts: Array<Record<string, unknown>> };
    for (const account of accounts) {
      expect(account).not.toHaveProperty('balance');
      expect(account).not.toHaveProperty('currentBalance');
    }
  });

  it('refuses a business outside the caller’s memberships', async () => {
    const client = clientReturning(fixture);
    const result = await run(listAccountsTool, client, authContext([B2]), { businessId: B1 });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// income_expense_summary
// ---------------------------------------------------------------------------

describe('incomeExpenseSummaryTool', () => {
  const fixture = {
    incomeExpenseChart: {
      currency: 'USD',
      fromDate: '2026-01-01',
      toDate: '2026-02-28',
      monthlyData: [
        { date: '2026-01-01', income: ils(1000), expense: ils(400), balance: ils(600) },
        { date: '2026-02-01', income: ils(500), expense: ils(100), balance: ils(1000) },
      ],
    },
  };

  it('returns per-month rows and period totals', async () => {
    const client = clientReturning(fixture);
    const result = await run(incomeExpenseSummaryTool, client, authContext([B1]), {
      businessId: B1,
      fromDate: '2026-01-01',
      toDate: '2026-02-28',
    });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      months: Array<{ month: string; cumulativeNet: { value: number } }>;
      totals: { income: number; expense: number; net: number; currency: string };
    };
    expect(structured.months).toHaveLength(2);
    expect(structured.months[0]!.month).toBe('2026-01-01');
    expect(structured.totals).toMatchObject({ income: 1500, expense: 500, net: 1000 });
    expect(structured.totals.currency).toBe('USD');
  });

  // Upstream calls this `balance`; renaming it is the point — it is a running
  // sum of the period's flows, not an account balance.
  it('renames the running sum to cumulativeNet', async () => {
    const client = clientReturning(fixture);
    const result = await run(incomeExpenseSummaryTool, client, authContext([B1]), {
      businessId: B1,
      fromDate: '2026-01-01',
      toDate: '2026-02-28',
    });
    const { months } = result.structuredContent as { months: Array<Record<string, unknown>> };
    expect(months[0]).toHaveProperty('cumulativeNet');
    expect(months[0]).not.toHaveProperty('balance');
  });

  it('forwards the requested currency to upstream', async () => {
    let sentBody: unknown;
    const client = clientReturning(fixture, body => (sentBody = body));
    await run(incomeExpenseSummaryTool, client, authContext([B1]), {
      businessId: B1,
      fromDate: '2026-01-01',
      toDate: '2026-02-28',
      currency: 'USD',
    });
    const { filters } = (sentBody as { variables: { filters: Record<string, unknown> } }).variables;
    expect(filters).toEqual({ fromDate: '2026-01-01', toDate: '2026-02-28', currency: 'USD' });
  });

  it('omits currency entirely when not requested', async () => {
    let sentBody: unknown;
    const client = clientReturning(fixture, body => (sentBody = body));
    await run(incomeExpenseSummaryTool, client, authContext([B1]), {
      businessId: B1,
      fromDate: '2026-01-01',
      toDate: '2026-02-28',
    });
    const { filters } = (sentBody as { variables: { filters: Record<string, unknown> } }).variables;
    expect('currency' in filters).toBe(false);
  });

  // A decade in one call is the "chart my money from the beginning" case.
  it('accepts a multi-year range but rejects one beyond the cap', async () => {
    const client = clientReturning(fixture);
    const ok = await run(incomeExpenseSummaryTool, client, authContext([B1]), {
      businessId: B1,
      fromDate: '2019-01-01',
      toDate: '2026-01-01',
    });
    expect(ok.isError).toBeUndefined();

    const tooWide = await run(incomeExpenseSummaryTool, client, authContext([B1]), {
      businessId: B1,
      fromDate: '2000-01-01',
      toDate: '2026-01-01',
    });
    expect(tooWide.isError).toBe(true);
    expect((tooWide.structuredContent as { message: string }).message).toContain(
      String(MAX_AGGREGATE_RANGE_DAYS),
    );
  });

  it('rejects an inverted range', async () => {
    const client = clientReturning(fixture);
    const result = await run(incomeExpenseSummaryTool, client, authContext([B1]), {
      businessId: B1,
      fromDate: '2026-03-01',
      toDate: '2026-01-01',
    });
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// profit_and_loss
// ---------------------------------------------------------------------------

describe('profitAndLossTool', () => {
  const year = (y: number) => ({
    year: y,
    revenue: { amount: ils(1_000_000) },
    costOfSales: { amount: ils(-200_000) },
    grossProfit: ils(800_000),
    researchAndDevelopmentExpenses: { amount: ils(-300_000) },
    marketingExpenses: { amount: ils(-50_000) },
    managementAndGeneralExpenses: { amount: ils(-100_000) },
    operatingProfit: ils(350_000),
    financialExpenses: { amount: ils(-10_000) },
    otherIncome: { amount: ils(5_000) },
    profitBeforeTax: ils(345_000),
    tax: ils(-79_350),
    netProfit: ils(265_650),
  });

  const fixture = {
    profitAndLossReport: { report: year(2026), reference: [year(2025)] },
  };

  it('flattens each line item to its total and keeps reference years', async () => {
    const client = clientReturning(fixture);
    const result = await run(profitAndLossTool, client, authContext([B1]), {
      businessId: B1,
      year: 2026,
      referenceYears: [2025],
    });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      years: Array<{ year: number; revenue: { value: number }; netProfit: { value: number } }>;
      reportYear: number;
    };
    expect(structured.reportYear).toBe(2026);
    // Report year first, then references.
    expect(structured.years.map(y => y.year)).toEqual([2026, 2025]);
    expect(structured.years[0]!.revenue.value).toBe(1_000_000);
    expect(structured.years[0]!.netProfit.value).toBe(265_650);
    // The per-sort-code `records` breakdown is intentionally dropped.
    expect(structured.years[0]).not.toHaveProperty('records');
  });

  it('rejects a report year that also appears in referenceYears', async () => {
    const client = clientReturning(fixture);
    const result = await run(profitAndLossTool, client, authContext([B1]), {
      businessId: B1,
      year: 2026,
      referenceYears: [2026],
    });
    expect(result.isError).toBe(true);
  });

  it('defaults referenceYears to empty', async () => {
    let sentBody: unknown;
    const client = clientReturning(
      { profitAndLossReport: { report: year(2026), reference: [] } },
      body => (sentBody = body),
    );
    await run(profitAndLossTool, client, authContext([B1]), { businessId: B1, year: 2026 });
    const { variables } = sentBody as { variables: { referenceYears: number[] } };
    expect(variables.referenceYears).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// vat_report
// ---------------------------------------------------------------------------

describe('vatReportTool', () => {
  const record = (vat: number, amount: number) => ({
    chargeId: 'c1',
    documentId: 'd1',
    documentSerial: 'INV-1',
    documentDate: '2026-01-10',
    chargeDate: '2026-01-10',
    business: { id: 'cp1', name: 'Acme' },
    amount: ils(amount),
    localAmount: ils(amount),
    localVat: ils(vat),
    localVatAfterDeduction: ils(vat),
    vatNumber: '123',
    isProperty: false,
  });

  const fixture = {
    vatReport: {
      income: [record(170, 1170), record(340, 2340)],
      expenses: [record(85, 585)],
    },
  };

  it('reports net VAT due from output minus input VAT', async () => {
    const client = clientReturning(fixture);
    const result = await run(vatReportTool, client, authContext([B1]), {
      businessId: B1,
      month: '2026-01-01',
    });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      totals: { income: { vat: number }; expenses: { vat: number }; netVatDue: number };
      recordCounts: { income: number; expenses: number };
      records: unknown[];
    };
    expect(structured.totals.income.vat).toBe(510);
    expect(structured.totals.expenses.vat).toBe(85);
    expect(structured.totals.netVatDue).toBe(425);
    expect(structured.recordCounts).toEqual({ income: 2, expenses: 1 });
    // Records are opt-in; the counts are reported either way.
    expect(structured.records).toEqual([]);
    expect(result.content[0]!.text).toContain('net VAT due 425.00');
  });

  it('returns individual records when asked', async () => {
    const client = clientReturning(fixture);
    const result = await run(vatReportTool, client, authContext([B1]), {
      businessId: B1,
      month: '2026-01-01',
      includeRecords: true,
    });
    const structured = result.structuredContent as {
      records: Array<{ counterparty: { name: string } }>;
    };
    expect(structured.records).toHaveLength(3);
    expect(structured.records[0]!.counterparty).toEqual({ id: 'cp1', name: 'Acme' });
  });

  it('describes a refund as negative net VAT', async () => {
    const client = clientReturning({
      vatReport: { income: [record(10, 100)], expenses: [record(60, 600)] },
    });
    const result = await run(vatReportTool, client, authContext([B1]), {
      businessId: B1,
      month: '2026-01-01',
    });
    expect((result.structuredContent as { totals: { netVatDue: number } }).totals.netVatDue).toBe(
      -50,
    );
    expect(result.content[0]!.text).toContain('refundable');
  });

  it('passes the business id and month to upstream', async () => {
    let sentBody: unknown;
    const client = clientReturning(fixture, body => (sentBody = body));
    await run(vatReportTool, client, authContext([B1]), { businessId: B1, month: '2026-01-01' });
    const { filters } = (sentBody as { variables: { filters: Record<string, unknown> } }).variables;
    expect(filters).toEqual({
      financialEntityId: B1,
      monthDate: '2026-01-01',
      chargesType: 'ALL',
    });
  });
});

// ---------------------------------------------------------------------------
// counterparty_totals
// ---------------------------------------------------------------------------

describe('counterpartyTotalsTool', () => {
  const sum = (id: string, name: string, total: number) => ({
    business: { id, name },
    credit: ils(total > 0 ? total : 0),
    debit: ils(total < 0 ? -total : 0),
    total: ils(total),
    foreignCurrenciesSum: [
      { currency: 'USD', credit: ils(1), debit: ils(0), total: ils(1) },
    ],
  });

  const fixture = {
    businessTransactionsSumFromLedgerRecords: {
      __typename: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult',
      businessTransactionsSum: [
        sum('small', 'Small Co', 100),
        sum('big', 'Big Co', -9000),
        sum('mid', 'Mid Co', 500),
      ],
    },
  };

  it('orders counterparties by absolute total so the biggest survive truncation', async () => {
    const client = clientReturning(fixture);
    const result = await run(counterpartyTotalsTool, client, authContext([B1]), {
      businessId: B1,
    });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      counterparties: Array<{ counterparty: { id: string }; total: { value: number } }>;
    };
    expect(structured.counterparties.map(row => row.counterparty.id)).toEqual([
      'big',
      'mid',
      'small',
    ]);
  });

  it('excludes revaluation entries unless asked', async () => {
    let sentBody: unknown;
    const client = clientReturning(fixture, body => (sentBody = body));
    await run(counterpartyTotalsTool, client, authContext([B1]), { businessId: B1 });
    const { filters } = (sentBody as { variables: { filters: Record<string, unknown> } }).variables;
    expect(filters).toEqual({ ownerIds: [B1], includeRevaluation: false });
  });

  // An empty list would read as "no activity" — a materially different answer.
  it('surfaces an upstream CommonError as an error, not an empty result', async () => {
    const client = clientReturning({
      businessTransactionsSumFromLedgerRecords: {
        __typename: 'CommonError',
        message: 'Ledger unavailable',
      },
    });
    const result = await run(counterpartyTotalsTool, client, authContext([B1]), {
      businessId: B1,
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toContain(
      'Ledger unavailable',
    );
  });
});

// ---------------------------------------------------------------------------
// ledger_records
// ---------------------------------------------------------------------------

describe('ledgerRecordsTool', () => {
  const fixture = {
    businessTransactionsFromLedgerRecords: {
      __typename: 'BusinessTransactionsFromLedgerRecordsSuccessfulResult',
      businessTransactions: [
        {
          chargeId: 'c1',
          invoiceDate: '2026-01-10',
          business: { id: 'cp1', name: 'Acme' },
          counterAccount: { id: 'ta1', name: 'Income' },
          amount: ils(1000),
          foreignAmount: { raw: 300, formatted: '$300', currency: 'USD' },
          details: 'Retainer',
          reference: 'REF-1',
        },
      ],
    },
  };

  it('normalizes ledger records', async () => {
    const client = clientReturning(fixture);
    const result = await run(ledgerRecordsTool, client, authContext([B1]), { businessId: B1 });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      records: Array<Record<string, unknown>>;
    };
    expect(structured.records[0]).toMatchObject({
      chargeId: 'c1',
      date: '2026-01-10',
      business: { id: 'cp1', name: 'Acme' },
      counterAccount: { id: 'ta1', name: 'Income' },
      details: 'Retainer',
      reference: 'REF-1',
    });
    expect(structured.records[0]!.foreignAmount).toEqual({
      value: 300,
      formatted: '$300',
      currency: 'USD',
    });
  });

  it('surfaces an upstream CommonError as an error', async () => {
    const client = clientReturning({
      businessTransactionsFromLedgerRecords: {
        __typename: 'CommonError',
        message: 'Bad filter',
      },
    });
    const result = await run(ledgerRecordsTool, client, authContext([B1]), { businessId: B1 });
    expect(result.isError).toBe(true);
  });

  // Row-level output keeps the tighter bound the other row tools use.
  it('rejects a range wider than the row-level cap', async () => {
    const client = clientReturning(fixture);
    const result = await run(ledgerRecordsTool, client, authContext([B1]), {
      businessId: B1,
      fromDate: '2019-01-01',
      toDate: '2026-01-01',
    });
    expect(result.isError).toBe(true);
  });
});
