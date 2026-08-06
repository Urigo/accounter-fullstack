import { z } from 'zod';
import type {
  McpCounterpartyTotalsQuery,
  McpCounterpartyTotalsQueryVariables,
  McpLedgerRecordsQuery,
  McpLedgerRecordsQueryVariables,
} from '../gql/index.js';
import { DAY_MS, parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { normalizeAmount } from './entity-shapes.js';
import { ToolInputError } from './execute.js';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import {
  assertAuthorizedBusiness,
  businessIdInput,
  SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
} from './scope-input.js';

/**
 * Ledger-backed tools (feedback §1).
 *
 * The double-entry ledger is the authoritative answer to "what kind of movement
 * was this" and "who did we transact with" — raw bank rows are not. These two
 * tools expose it at both levels: aggregated per counterparty, and record by
 * record.
 *
 * Both upstream queries return a union with `CommonError`, so both handlers must
 * branch on `__typename` rather than assuming success.
 */

export const COUNTERPARTY_TOTALS_TOOL_NAME = 'accounter_counterparty_totals';
export const LEDGER_RECORDS_TOOL_NAME = 'accounter_ledger_records';

/** Row-level output, so the same ~3-year bound the other row tools use. */
export const MAX_LEDGER_RANGE_DAYS = 1096;
/** Aggregated per counterparty — a decade of totals is still a small payload. */
export const MAX_TOTALS_RANGE_DAYS = 3660;

const ID_LIST_CAP = 100;

function optionalIdList(max: number) {
  return z.preprocess(
    value => (Array.isArray(value) && value.length === 0 ? undefined : value),
    z.array(z.string().min(1)).min(1).max(max).optional(),
  );
}

function assertRange(fromDate: string | undefined, toDate: string | undefined, maxDays: number) {
  let from: number | undefined;
  let to: number | undefined;
  if (fromDate !== undefined) {
    const parsed = parseCalendarDate(fromDate);
    if (parsed === null) throw new ToolInputError('Invalid fromDate');
    from = parsed;
  }
  if (toDate !== undefined) {
    const parsed = parseCalendarDate(toDate);
    if (parsed === null) throw new ToolInputError('Invalid toDate');
    to = parsed;
  }
  if (from !== undefined && to !== undefined) {
    if (from > to) {
      throw new ToolInputError('fromDate must be on or before toDate');
    }
    if (Math.round((to - from) / DAY_MS) > maxDays) {
      throw new ToolInputError(`Date range must not exceed ${maxDays} days`);
    }
  }
}

/**
 * Surface an upstream `CommonError` as a tool input error rather than an empty
 * result — an empty list would read as "this business had no activity", which is
 * a materially different (and wrong) answer.
 */
function assertNotCommonError(result: { __typename?: string; message?: string }): void {
  if (result.__typename === 'CommonError') {
    throw new ToolInputError(result.message ?? 'Upstream rejected the ledger query');
  }
}

// ---------------------------------------------------------------------------
// Counterparty totals
// ---------------------------------------------------------------------------

const counterpartyTotalsInput = z.object({
  businessId: businessIdInput,
  fromDate: TIMELESS_DATE.optional().describe('Only ledger records on/after this date.'),
  toDate: TIMELESS_DATE.optional().describe('Only ledger records on/before this date.'),
  counterpartyIds: optionalIdList(ID_LIST_CAP)
    .optional()
    .describe('Restrict to these counterparty (business) ids. Omit for all counterparties.'),
  includeRevaluation: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Include currency revaluation entries. These are bookkeeping adjustments, not real ' +
        'activity, so they are excluded by default.',
    ),
});

type CounterpartyTotalsInput = z.infer<typeof counterpartyTotalsInput>;

const COUNTERPARTY_TOTALS_QUERY = /* GraphQL */ `
  query McpCounterpartyTotals($filters: BusinessTransactionsFilter) {
    businessTransactionsSumFromLedgerRecords(filters: $filters) {
      __typename
      ... on BusinessTransactionsSumFromLedgerRecordsSuccessfulResult {
        businessTransactionsSum {
          business {
            id
            name
          }
          credit {
            raw
            formatted
            currency
          }
          debit {
            raw
            formatted
            currency
          }
          total {
            raw
            formatted
            currency
          }
          foreignCurrenciesSum {
            currency
            credit {
              raw
              formatted
              currency
            }
            debit {
              raw
              formatted
              currency
            }
            total {
              raw
              formatted
              currency
            }
          }
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

async function counterpartyTotalsHandler(
  input: CounterpartyTotalsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  assertRange(input.fromDate, input.toDate, MAX_TOTALS_RANGE_DAYS);
  const ownerId = assertAuthorizedBusiness(input.businessId, context);

  const variables: McpCounterpartyTotalsQueryVariables = {
    filters: {
      ownerIds: [ownerId],
      includeRevaluation: input.includeRevaluation,
      ...(input.fromDate ? { fromDate: input.fromDate } : {}),
      ...(input.toDate ? { toDate: input.toDate } : {}),
      ...(input.counterpartyIds ? { businessIDs: [...input.counterpartyIds] } : {}),
    },
  };
  const data = await context.client.query<McpCounterpartyTotalsQuery>(
    { query: COUNTERPARTY_TOTALS_QUERY, variables },
    context.upstream,
  );

  const result = data.businessTransactionsSumFromLedgerRecords;
  assertNotCommonError(result);
  const rows =
    result.__typename === 'BusinessTransactionsSumFromLedgerRecordsSuccessfulResult'
      ? result.businessTransactionsSum
      : [];

  const counterparties = rows
    .map(row => ({
      counterparty: { id: row.business.id, name: row.business.name },
      credit: normalizeAmount(row.credit),
      debit: normalizeAmount(row.debit),
      total: normalizeAmount(row.total),
      foreignCurrencies: (row.foreignCurrenciesSum ?? []).map(sum => ({
        currency: sum.currency,
        credit: normalizeAmount(sum.credit),
        debit: normalizeAmount(sum.debit),
        total: normalizeAmount(sum.total),
      })),
    }))
    // Largest absolute total first: "top customers"/"biggest suppliers" is the
    // question this answers, and the byte guard drops from the tail.
    .sort((a, b) => Math.abs(b.total?.value ?? 0) - Math.abs(a.total?.value ?? 0));

  return shapeListResult({
    items: counterparties,
    itemsKey: 'counterparties',
    total: counterparties.length,
    extra: {
      businessId: ownerId,
      period: { fromDate: input.fromDate ?? null, toDate: input.toDate ?? null },
      scope: { businessIds: context.readScope.businessIds },
    },
    summarize: (shown, total) =>
      total === 0
        ? 'No ledger activity matched the given filters.'
        : `${total} counterparty/counterparties${shown < total ? ` (showing top ${shown})` : ''}, ` +
          'ordered by absolute total.',
  });
}

export const counterpartyTotalsTool: ToolDefinition<typeof counterpartyTotalsInput> = {
  name: COUNTERPARTY_TOTALS_TOOL_NAME,
  description:
    'Totals per counterparty from the double-entry ledger for one business — credit, debit and ' +
    'net total in local currency, plus a per-currency breakdown, ordered by largest absolute ' +
    'total. This is the direct way to answer “who are our biggest customers/suppliers” or to ' +
    'break revenue and expense down by counterparty, without aggregating charges yourself. ' +
    'Read-only. ' +
    SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: counterpartyTotalsInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
  },
  handler: counterpartyTotalsHandler,
};

// ---------------------------------------------------------------------------
// Ledger records
// ---------------------------------------------------------------------------

const ledgerRecordsInput = z.object({
  businessId: businessIdInput,
  fromDate: TIMELESS_DATE.optional().describe('Only ledger records on/after this date.'),
  toDate: TIMELESS_DATE.optional().describe('Only ledger records on/before this date.'),
  counterpartyIds: optionalIdList(ID_LIST_CAP)
    .optional()
    .describe('Restrict to these counterparty (business) ids.'),
  includeRevaluation: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include currency revaluation entries (excluded by default).'),
});

type LedgerRecordsInput = z.infer<typeof ledgerRecordsInput>;

const LEDGER_RECORDS_QUERY = /* GraphQL */ `
  query McpLedgerRecords($filters: BusinessTransactionsFilter) {
    businessTransactionsFromLedgerRecords(filters: $filters) {
      __typename
      ... on BusinessTransactionsFromLedgerRecordsSuccessfulResult {
        businessTransactions {
          chargeId
          invoiceDate
          business {
            id
            name
          }
          counterAccount {
            id
            name
          }
          amount {
            raw
            formatted
            currency
          }
          foreignAmount {
            raw
            formatted
            currency
          }
          details
          reference
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

async function ledgerRecordsHandler(
  input: LedgerRecordsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  assertRange(input.fromDate, input.toDate, MAX_LEDGER_RANGE_DAYS);
  const ownerId = assertAuthorizedBusiness(input.businessId, context);

  const variables: McpLedgerRecordsQueryVariables = {
    filters: {
      ownerIds: [ownerId],
      includeRevaluation: input.includeRevaluation,
      ...(input.fromDate ? { fromDate: input.fromDate } : {}),
      ...(input.toDate ? { toDate: input.toDate } : {}),
      ...(input.counterpartyIds ? { businessIDs: [...input.counterpartyIds] } : {}),
    },
  };
  const data = await context.client.query<McpLedgerRecordsQuery>(
    { query: LEDGER_RECORDS_QUERY, variables },
    context.upstream,
  );

  const result = data.businessTransactionsFromLedgerRecords;
  assertNotCommonError(result);
  const rows =
    result.__typename === 'BusinessTransactionsFromLedgerRecordsSuccessfulResult'
      ? result.businessTransactions
      : [];

  const records = rows.map(row => ({
    chargeId: row.chargeId,
    date: row.invoiceDate,
    business: { id: row.business.id, name: row.business.name },
    counterAccount: row.counterAccount
      ? { id: row.counterAccount.id, name: row.counterAccount.name }
      : null,
    amount: normalizeAmount(row.amount),
    foreignAmount: normalizeAmount(row.foreignAmount),
    details: row.details ?? null,
    reference: row.reference ?? null,
  }));

  return shapeListResult({
    items: records,
    itemsKey: 'records',
    total: records.length,
    extra: {
      businessId: ownerId,
      period: { fromDate: input.fromDate ?? null, toDate: input.toDate ?? null },
      scope: { businessIds: context.readScope.businessIds },
    },
    summarize: (shown, total) =>
      total === 0
        ? 'No ledger records matched the given filters.'
        : `${total} ledger record(s)${shown < total ? ` (showing ${shown})` : ''}.`,
  });
}

export const ledgerRecordsTool: ToolDefinition<typeof ledgerRecordsInput> = {
  name: LEDGER_RECORDS_TOOL_NAME,
  description:
    'Individual double-entry ledger records for one business: date, counterparty, counter ' +
    'account, local and foreign amounts, charge id, and reference. Use this when you need to see ' +
    'how a movement was actually booked — the ledger, not the raw bank feed, is authoritative ' +
    'about what a movement was. For per-counterparty aggregates use ' +
    '`accounter_counterparty_totals` instead. Read-only. ' +
    SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: ledgerRecordsInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
  },
  handler: ledgerRecordsHandler,
};
