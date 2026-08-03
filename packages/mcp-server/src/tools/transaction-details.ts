import { z } from 'zod';
import type { McpGetTransactionsQuery, McpGetTransactionsQueryVariables } from '../gql/index.js';
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

const getTransactionsInput = z.object({
  transactionIds: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_DETAIL_IDS)
    .describe(
      `The transaction ids to fetch (1–${MAX_DETAIL_IDS}). Discover ids via accounter_get_charges ` +
        '(each charge lists its transactions) or accounter_search_charges.',
    ),
  businessIds: businessIdsInput,
});

type GetTransactionsInput = z.infer<typeof getTransactionsInput>;

const GET_TRANSACTIONS_QUERY = /* GraphQL */ `
  query McpGetTransactions($transactionIDs: [UUID!]!) {
    transactionsByIDs(transactionIDs: $transactionIDs) {
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
  }
`;

async function handler(
  input: GetTransactionsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const variables: McpGetTransactionsQueryVariables = { transactionIDs: input.transactionIds };
  const data = await context.client.query<McpGetTransactionsQuery>(
    { query: GET_TRANSACTIONS_QUERY, variables },
    context.upstream,
  );

  const transactions = (data.transactionsByIDs ?? []).map(raw =>
    normalizeTransaction(raw as RawTransaction),
  );

  return shapeListResult({
    items: transactions,
    itemsKey: 'transactions',
    total: transactions.length,
    extra: { scope: { businessIds: context.readScope.businessIds } },
    summarize: (shown, total) =>
      total === 0
        ? 'No transactions were found for the given ids (they may be outside your authorized businesses).'
        : `Found ${total} transaction(s)${shown < total ? ` (showing ${shown})` : ''}.`,
  });
}

export const getTransactionsTool: ToolDefinition<typeof getTransactionsInput> = {
  name: GET_TRANSACTIONS_TOOL_NAME,
  description:
    'Fetch bank/card transactions by id, with amount, dates, direction, counterparty, and account. Read-only. ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: getTransactionsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
