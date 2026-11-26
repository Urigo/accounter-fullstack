import { z } from 'zod';
import type {
  McpUncategorizedTransactionGroupsQuery,
  McpUncategorizedTransactionGroupsQueryVariables,
} from '../gql/index.js';
import { parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { ToolInputError } from './execute.js';
import { resultEnvelopeDescription, shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { assertMemberBusiness, memberBusinessIdInput } from './reports/shared.js';
import { SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Read tool: a business's transactions that have no counterparty yet, grouped by normalised
 * source description, largest group first.
 *
 * Built for categorising a freshly ingested tenant: after the first scrape every transaction
 * lacks a counterparty, and paging thousands of rows through `accounter_get_transactions` to
 * group them client-side costs far more than deciding a few hundred groups. The grouping runs
 * upstream in SQL (`uncategorizedTransactionGroups`), so this is one round trip.
 *
 * Single-business on purpose: a group's totals and counts are aggregates, so its rows cannot carry
 * a per-row `ownerId` the way the multi-business list tools promise.
 *
 * The same operation serves both halves of the workflow: list groups with a small `sampleSize`,
 * then call again with `keys` and a large `sampleSize` to get every id of the groups being acted on.
 */

export const UNCATEGORIZED_TRANSACTION_GROUPS_TOOL_NAME =
  'accounter_list_uncategorized_transaction_groups';

export const DEFAULT_GROUP_SAMPLE_SIZE = 5;
/** Below the upstream cap of 500: 200 ids per group already fills a result for a few groups. */
export const MAX_GROUP_SAMPLE_SIZE = 200;
export const DEFAULT_GROUPS_LIMIT = 200;
export const MAX_GROUPS_LIMIT = 500;
export const MAX_GROUP_KEYS = 50;

const calendarDate = TIMELESS_DATE.refine(value => parseCalendarDate(value) !== null, {
  message: 'must be a real calendar date',
});

const uncategorizedTransactionGroupsInput = z.object({
  memberBusinessId: memberBusinessIdInput,
  fromDate: calendarDate
    .optional()
    .describe('Only transactions with an event date on or after this date, YYYY-MM-DD.'),
  toDate: calendarDate
    .optional()
    .describe('Only transactions with an event date on or before this date, YYYY-MM-DD.'),
  minCount: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Only groups with at least this many transactions (e.g. 2 to skip one-offs).'),
  keys: z
    .array(z.string())
    .min(1)
    .max(MAX_GROUP_KEYS)
    .optional()
    .describe(
      `Return only these groups, by the \`key\` an earlier call returned (1-${MAX_GROUP_KEYS}). ` +
        'Combine with a large `sampleSize` to fetch every transaction and charge id of the groups ' +
        'you are about to update.',
    ),
  sampleSize: z
    .number()
    .int()
    .min(1)
    .max(MAX_GROUP_SAMPLE_SIZE)
    .default(DEFAULT_GROUP_SAMPLE_SIZE)
    .describe(
      `How many transaction ids and charge ids to return per group (1-${MAX_GROUP_SAMPLE_SIZE}, ` +
        `default ${DEFAULT_GROUP_SAMPLE_SIZE}).`,
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_GROUPS_LIMIT)
    .default(DEFAULT_GROUPS_LIMIT)
    .describe(`Groups per page (1-${MAX_GROUPS_LIMIT}, default ${DEFAULT_GROUPS_LIMIT}).`),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe(
      'Groups to skip, for the next page: the previous offset plus its `returnedCount`. A group ' +
        'drops out once its transactions have a counterparty and the rest move up, so after ' +
        'updating a page, ask for offset 0 again rather than the next offset.',
    ),
});
type UncategorizedTransactionGroupsInput = z.infer<typeof uncategorizedTransactionGroupsInput>;

const UNCATEGORIZED_TRANSACTION_GROUPS_QUERY = /* GraphQL */ `
  query McpUncategorizedTransactionGroups(
    $filters: UncategorizedTransactionGroupsFilters
    $sampleSize: Int
    $limit: Int
    $offset: Int
  ) {
    uncategorizedTransactionGroups(
      filters: $filters
      sampleSize: $sampleSize
      limit: $limit
      offset: $offset
    ) {
      totalGroups
      totalTransactions
      groups {
        key
        sampleDescription
        transactionCount
        chargeCount
        totals {
          currency
          amount
          transactionCount
        }
        minEventDate
        maxEventDate
        transactionIds
        chargeIds
      }
    }
  }
`;

async function handler(
  input: UncategorizedTransactionGroupsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  if (input.fromDate && input.toDate && input.fromDate > input.toDate) {
    throw new ToolInputError('fromDate must be on or before toDate');
  }
  const ownerId = assertMemberBusiness(context, input.memberBusinessId);

  const filters: NonNullable<McpUncategorizedTransactionGroupsQueryVariables['filters']> = {
    byOwners: [ownerId],
  };
  if (input.fromDate) filters.fromEventDate = input.fromDate;
  if (input.toDate) filters.toEventDate = input.toDate;
  if (input.minCount !== undefined) filters.minCount = input.minCount;
  if (input.keys) filters.keys = [...input.keys];

  const variables: McpUncategorizedTransactionGroupsQueryVariables = {
    filters,
    sampleSize: input.sampleSize,
    limit: input.limit,
    offset: input.offset,
  };
  const data = await context.client.query<McpUncategorizedTransactionGroupsQuery>(
    { query: UNCATEGORIZED_TRANSACTION_GROUPS_QUERY, variables },
    context.upstream,
  );

  const result = data.uncategorizedTransactionGroups;
  const groups = result.groups.map(group => ({
    key: group.key,
    sampleDescription: group.sampleDescription ?? null,
    transactionCount: group.transactionCount,
    chargeCount: group.chargeCount,
    totals: group.totals.map(total => ({
      currency: total.currency,
      amount: total.amount,
      transactionCount: total.transactionCount,
    })),
    firstDate: group.minEventDate,
    lastDate: group.maxEventDate,
    transactionIds: group.transactionIds,
    chargeIds: group.chargeIds,
  }));

  // `totalCount` counts groups from `offset` on, so `truncated` means "more after this page".
  const remaining = Math.max(result.totalGroups - input.offset, groups.length);
  return shapeListResult({
    items: groups,
    itemsKey: 'groups',
    total: remaining,
    extra: {
      memberBusinessId: ownerId,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
      offset: input.offset,
      totalGroups: result.totalGroups,
      totalTransactions: result.totalTransactions,
    },
    summarize: (shown, total) =>
      result.totalGroups === 0
        ? 'No transactions without a counterparty matched.'
        : `${result.totalTransactions} transaction(s) without a counterparty in ` +
          `${result.totalGroups} group(s); showing ${shown} from offset ${input.offset}` +
          `${shown < total ? ' — more remain' : ''}.`,
  });
}

export const uncategorizedTransactionGroupsTool: ToolDefinition<
  typeof uncategorizedTransactionGroupsInput
> = {
  name: UNCATEGORIZED_TRANSACTION_GROUPS_TOOL_NAME,
  description:
    'List one business’s transactions that have no counterparty yet, grouped by normalised ' +
    'source description (lower case, whitespace collapsed, runs of 4+ digits replaced by `#`, so ' +
    'card and reference numbers do not split a merchant), largest group first. Each group gives ' +
    '`key`, a `sampleDescription` (the most recent raw text), `transactionCount`, `chargeCount`, ' +
    '`totals` per currency (signed: negative is money out), `firstDate` / `lastDate` and up to ' +
    '`sampleSize` `transactionIds` and `chargeIds`. Use it to categorise a freshly imported ' +
    'business a group at a time instead of paging every row: decide a counterparty per group, ' +
    'call again with `keys` and a large `sampleSize` for the ids, then set them with ' +
    '`accounter_update_transactions`, `accounter_update_charges` and ' +
    '`accounter_update_charges_tags`. `totalGroups` and `totalTransactions` cover every page; ' +
    'page with `offset`. Read-only. ' +
    resultEnvelopeDescription('groups') +
    ' ' +
    SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: uncategorizedTransactionGroupsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
