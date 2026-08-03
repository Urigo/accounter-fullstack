import { z } from 'zod';
import type {
  McpGetTransactionsQuery,
  McpGetTransactionsQueryVariables,
  McpSearchTransactionsByFiltersQuery,
  McpSearchTransactionsByFiltersQueryVariables,
} from '../gql/index.js';
import { TIMELESS_DATE } from './dates.js';
import { MAX_DETAIL_IDS, normalizeTransaction, type RawTransaction } from './entity-shapes.js';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { businessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Detail tool: fetch bank/card transactions by id (spec §8.2).
 *
 * Read-only. Results are narrowed to the caller's authorized businesses by
 * upstream RLS (the resolved read scope travels as `x-business-scope` on
 * `context.upstream`), so an id outside the caller's businesses simply resolves
 * to nothing — the response never carries a transaction the caller may not read.
 * Transactions expose no owner field of their own, so — unlike `get_charges`
 * and `get_documents` — there is no post-fetch owner filter to apply here; RLS
 * is the sole scope boundary.
 */

export const GET_TRANSACTIONS_TOOL_NAME = 'accounter_get_transactions';

const TRANSACTION_FILTER_IDS_CAP = 100;

function optionalNonEmptyStringArray(max: number) {
  return z.preprocess(
    value => (Array.isArray(value) && value.length === 0 ? undefined : value),
    z.array(z.string().min(1)).min(1).max(max).optional(),
  );
}

const transactionFiltersInput = z
  .object({
    byIds: optionalNonEmptyStringArray(TRANSACTION_FILTER_IDS_CAP)
      .optional()
      .describe('Include only these transaction ids.'),
    byChargeIds: optionalNonEmptyStringArray(TRANSACTION_FILTER_IDS_CAP)
      .optional()
      .describe('Include only transactions linked to these charge ids.'),
    byOwners: optionalNonEmptyStringArray(TRANSACTION_FILTER_IDS_CAP)
      .optional()
      .describe('Include only transactions owned by these business ids.'),
    fromEventDate: TIMELESS_DATE.optional().describe(
      'Only transactions with eventDate on/after this date.',
    ),
    toEventDate: TIMELESS_DATE.optional().describe(
      'Only transactions with eventDate on/before this date.',
    ),
    fromDebitDate: TIMELESS_DATE.optional().describe(
      'Only transactions with effectiveDate on/after this date.',
    ),
    toDebitDate: TIMELESS_DATE.optional().describe(
      'Only transactions with effectiveDate on/before this date.',
    ),
    fromAnyDate: TIMELESS_DATE.optional().describe(
      'Only transactions with any date (event/debit) on/after this date.',
    ),
    toAnyDate: TIMELESS_DATE.optional().describe(
      'Only transactions with any date (event/debit) on/before this date.',
    ),
    byCounterparties: optionalNonEmptyStringArray(TRANSACTION_FILTER_IDS_CAP)
      .optional()
      .describe('Include only transactions whose counterparty id is in this list.'),
    withMissingCounterparty: z
      .boolean()
      .optional()
      .describe('Include only transactions with no linked counterparty.'),
    withMissingInfo: z
      .boolean()
      .optional()
      .describe('Include only transactions that fail required info validation.'),
    freeText: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Free text search across transaction fields.'),
  })
  .strict();

const getTransactionsInput = z
  .object({
    transactionIds: optionalNonEmptyStringArray(MAX_DETAIL_IDS)
      .optional()
      .describe(
        `The transaction ids to fetch (1–${MAX_DETAIL_IDS}). Discover ids via accounter_get_charges ` +
          '(each charge lists its transactions) or accounter_search_charges.',
      ),
    filters: transactionFiltersInput
      .optional()
      .describe('Filter transactions by any supported transactionsByFilters predicate.'),
    businessIds: businessIdsInput,
  })
  .superRefine((value, context) => {
    const hasIds = value.transactionIds !== undefined && value.transactionIds.length > 0;
    const hasFilters =
      value.filters !== undefined &&
      Object.values(value.filters).some(filterValue => filterValue !== undefined);
    if (!hasIds && !hasFilters) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transactionIds'],
        message: 'Provide transactionIds, filters, or both.',
      });
    }
  });

type GetTransactionsInput = z.infer<typeof getTransactionsInput>;

type TransactionsFiltersInput = z.infer<typeof transactionFiltersInput>;

const TRANSACTIONS_QUERY_DOCUMENT = /* GraphQL */ `
  fragment McpTransactionDetailsFields on Transaction {
    __typename
    id
    chargeId
    eventDate
    effectiveDate
    direction
    amount {
      raw
      formatted
      currency
    }
    sourceDescription
    isFee
    counterparty {
      id
      name
    }
    account {
      id
      name
    }
  }

  query McpGetTransactions($transactionIDs: [UUID!]!) {
    transactionsByIDs(transactionIDs: $transactionIDs) {
      ...McpTransactionDetailsFields
    }
  }

  query McpSearchTransactionsByFilters($filters: TransactionsFilters) {
    transactionsByFilters(filters: $filters) {
      ...McpTransactionDetailsFields
    }
  }
`;

function intersectOwners(
  requested: readonly string[] | undefined,
  scopeBusinessIds: readonly string[],
): string[] {
  const scopeSet = new Set(scopeBusinessIds);
  if (!requested || requested.length === 0) {
    return [...scopeBusinessIds];
  }
  return requested.filter(id => scopeSet.has(id));
}

function buildTransactionsFilters(
  input: TransactionsFiltersInput,
  requestedTransactionIds: readonly string[] | undefined,
  scopeBusinessIds: readonly string[],
): McpSearchTransactionsByFiltersQueryVariables['filters'] {
  const ownerIds = intersectOwners(input.byOwners, scopeBusinessIds);
  const idsFromFilter = input.byIds;
  const byIds =
    requestedTransactionIds && requestedTransactionIds.length > 0
      ? idsFromFilter && idsFromFilter.length > 0
        ? requestedTransactionIds.filter(id => idsFromFilter.includes(id))
        : [...requestedTransactionIds]
      : idsFromFilter;
  const filters: McpSearchTransactionsByFiltersQueryVariables['filters'] = {
    byOwners: ownerIds,
  };
  if (byIds && byIds.length > 0) filters.byIds = [...byIds];
  if (input.byChargeIds) filters.byChargeIds = [...input.byChargeIds];
  if (input.fromEventDate) filters.fromEventDate = input.fromEventDate;
  if (input.toEventDate) filters.toEventDate = input.toEventDate;
  if (input.fromDebitDate) filters.fromDebitDate = input.fromDebitDate;
  if (input.toDebitDate) filters.toDebitDate = input.toDebitDate;
  if (input.fromAnyDate) filters.fromAnyDate = input.fromAnyDate;
  if (input.toAnyDate) filters.toAnyDate = input.toAnyDate;
  if (input.byCounterparties) filters.byCounterparties = [...input.byCounterparties];
  if (input.withMissingCounterparty !== undefined) {
    filters.withMissingCounterparty = input.withMissingCounterparty;
  }
  if (input.withMissingInfo !== undefined) {
    filters.withMissingInfo = input.withMissingInfo;
  }
  if (input.freeText) filters.freeText = input.freeText;
  return filters;
}

async function handler(
  input: GetTransactionsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const hasTransactionIds = input.transactionIds !== undefined && input.transactionIds.length > 0;
  const hasFilters =
    input.filters !== undefined &&
    Object.values(input.filters).some(filterValue => filterValue !== undefined);
  const usingIds = hasTransactionIds && !hasFilters;
  const transactions = usingIds
    ? await (async () => {
        const variables: McpGetTransactionsQueryVariables = {
          transactionIDs: input.transactionIds!,
        };
        const data = await context.client.query<McpGetTransactionsQuery>(
          {
            query: TRANSACTIONS_QUERY_DOCUMENT,
            operationName: 'McpGetTransactions',
            variables,
          },
          context.upstream,
        );
        return (data.transactionsByIDs ?? []).map(raw =>
          normalizeTransaction(raw as RawTransaction),
        );
      })()
    : await (async () => {
        const variables: McpSearchTransactionsByFiltersQueryVariables = {
          filters: buildTransactionsFilters(
            input.filters ?? {},
            input.transactionIds,
            context.readScope.businessIds,
          ),
        };
        const data = await context.client.query<McpSearchTransactionsByFiltersQuery>(
          {
            query: TRANSACTIONS_QUERY_DOCUMENT,
            operationName: 'McpSearchTransactionsByFilters',
            variables: variables as unknown as Record<string, unknown>,
          },
          context.upstream,
        );
        return (data.transactionsByFilters ?? []).map(raw => normalizeTransaction(raw));
      })();

  return shapeListResult({
    items: transactions,
    itemsKey: 'transactions',
    total: transactions.length,
    extra: { scope: { businessIds: context.readScope.businessIds } },
    summarize: (shown, total) =>
      total === 0
        ? usingIds
          ? 'No transactions were found for the given ids (they may be outside your authorized businesses).'
          : 'No transactions matched the given filters.'
        : `Found ${total} transaction(s)${shown < total ? ` (showing ${shown})` : ''}.`,
  });
}

export const getTransactionsTool: ToolDefinition<typeof getTransactionsInput> = {
  name: GET_TRANSACTIONS_TOOL_NAME,
  description:
    'Fetch bank/card transactions either by id or by filters (owners, charge ids, date ranges, counterparties, missing-info flags, and free-text), with amount, dates, direction, counterparty, and account. Read-only. ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: getTransactionsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
