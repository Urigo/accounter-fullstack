import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { BUSINESS_SCOPE_HEADER, UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME } from '../businesses.js';
import { executeRegisteredTool } from '../execute.js';
import { toolRegistry } from '../registry-instance.js';

/**
 * The cross-cutting guard: iterate the *production registry* rather than a
 * hand-listed set, so a tool added later cannot silently regress.
 *
 * Every registered tool that talks upstream must send `x-business-scope` with
 * the resolved ids and echo `scope.businessIds`. Asserting on the outbound HTTP
 * headers (not the context object) means a handler that hand-builds
 * `{ correlationId, authorization }` and drops the scope fails here.
 */

const B1 = 'aa000000-0000-4000-8000-000000000001';
const B2 = 'aa000000-0000-4000-8000-000000000002';

const PRINCIPAL: AuthPrincipal = {
  subject: 'user-1',
  issuer: 'https://tenant.auth0.com/',
  audience: 'aud',
  scopes: [],
  email: null,
  expiresAt: undefined,
  claims: { sub: 'user-1' },
};

function authContext(): McpAuthContext {
  return buildAuthContext(PRINCIPAL, [
    { businessId: B1, roleId: 'business_owner' },
    { businessId: B2, roleId: 'business_owner' },
  ]);
}

/** Upstream payloads keyed by the operation each tool issues. */
function dataFor(query: string): unknown {
  if (query.includes('allCharges')) {
    return {
      allCharges: {
        nodes: [],
        pageInfo: { totalPages: 1, totalRecords: 0, currentPage: 1, pageSize: 25 },
      },
    };
  }
  if (query.includes('chargesByIDs')) return { chargesByIDs: [] };
  if (query.includes('transactionsByIDs')) return { transactionsByIDs: [] };
  if (query.includes('documentsByIds')) return { documentsByIds: [] };
  if (query.includes('allTags')) return { allTags: [] };
  if (query.includes('taxCategories')) return { taxCategories: [] };
  if (query.includes('allBusinesses')) return { allBusinesses: { nodes: [] } };
  if (query.includes('transactionsForBalanceReport')) return { transactionsForBalanceReport: [] };
  if (query.includes('financialAccountsByOwner')) return { financialAccountsByOwner: [] };
  if (query.includes('incomeExpenseChart')) {
    return {
      incomeExpenseChart: {
        currency: 'ILS',
        fromDate: '2026-01-01',
        toDate: '2026-03-01',
        monthlyData: [],
      },
    };
  }
  if (query.includes('profitAndLossReport')) {
    return { profitAndLossReport: { report: { year: 2026 }, reference: [] } };
  }
  if (query.includes('vatReport')) return { vatReport: { income: [], expenses: [] } };
  if (query.includes('businessTransactionsSumFromLedgerRecords')) {
    return {
      businessTransactionsSumFromLedgerRecords: {
        __typename: 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult',
        businessTransactionsSum: [],
      },
    };
  }
  if (query.includes('businessTransactionsFromLedgerRecords')) {
    return {
      businessTransactionsFromLedgerRecords: {
        __typename: 'BusinessTransactionsFromLedgerRecordsSuccessfulResult',
        businessTransactions: [],
      },
    };
  }
  return {};
}

function capturingClient() {
  const headersSeen: Array<Record<string, string>> = [];
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    headersSeen.push(init.headers as Record<string, string>);
    const body = JSON.parse(init.body as string) as { query: string };
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: dataFor(body.query) }),
    } as unknown as Response;
  });
  const client = new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, headersSeen };
}

/**
 * Minimal valid arguments per tool; everything else is optional.
 *
 * Any entry carrying `businessId` is a single-business tool, which is also how
 * the expected scope below is derived — so a new report tool only has to be
 * listed here once.
 */
const ARGS_BY_TOOL: Record<string, unknown> = {
  accounter_balance_report: { businessId: B1, fromDate: '2026-01-01', toDate: '2026-03-01' },
  accounter_get_charges: { chargeIds: ['c1'] },
  accounter_get_transactions: { transactionIds: ['t1'] },
  accounter_get_documents: { documentIds: ['d1'] },
  accounter_list_accounts: { businessId: B1 },
  accounter_income_expense_summary: {
    businessId: B1,
    fromDate: '2026-01-01',
    toDate: '2026-03-01',
  },
  accounter_profit_and_loss: { businessId: B1, year: 2026 },
  accounter_vat_report: { businessId: B1, month: '2026-01-01' },
  accounter_counterparty_totals: { businessId: B1 },
  accounter_ledger_records: { businessId: B1 },
};

/** A tool that took a singular `businessId` must have narrowed the scope to it. */
function expectedScopeFor(name: string): string[] {
  const args = ARGS_BY_TOOL[name] as { businessId?: string } | undefined;
  return args?.businessId ? [args.businessId] : [B1, B2];
}

describe('registry-wide business-scope forwarding', () => {
  const tools = toolRegistry.list();

  it('has tools registered (guards against an empty-registry false pass)', () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  it.each(tools.map(tool => [tool.name, tool] as const))(
    '%s forwards the resolved scope and echoes it',
    async (name, tool) => {
      const { client, headersSeen } = capturingClient();
      const result = await executeRegisteredTool({
        tool,
        rawArgs: ARGS_BY_TOOL[name] ?? {},
        auth: authContext(),
        correlationId: 'c',
        client,
        authorization: 'Bearer t',
      });

      expect(result.isError, `${name} should succeed`).toBeUndefined();
      const structured = result.structuredContent as Record<string, unknown>;

      if (name === LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME) {
        // Discovery is pure and *is* the scope — no upstream call, no echo.
        expect(headersSeen).toHaveLength(0);
        expect(structured).not.toHaveProperty('scope');
        return;
      }

      expect(headersSeen.length, `${name} should call upstream`).toBeGreaterThan(0);
      // Single-business tools narrow to their businessId; the rest keep both.
      const expectedScope = expectedScopeFor(name);
      for (const headers of headersSeen) {
        expect(headers[BUSINESS_SCOPE_HEADER]).toBe(expectedScope.join(','));
      }
      expect(structured.scope).toEqual({ businessIds: expectedScope });
    },
  );
});
