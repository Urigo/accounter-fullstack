import { z } from 'zod';
import type { McpBalanceReportQuery, McpBalanceReportQueryVariables } from '../gql/index.js';
import { DAY_MS, parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { normalizeAmount } from './entity-shapes.js';
import { ToolInputError } from './execute.js';
import { resultEnvelopeDescription, shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Tool 3: a selected read-only report (spec §8.2).
 *
 * Phase 1 exposes one report — the balance report — for a single authorized
 * business over a bounded date range. Output rows are capped to avoid large
 * unbounded payloads. Role-gated to business owners / accountants.
 */

export const BALANCE_REPORT_TOOL_NAME = 'accounter_balance_report';

/** Bounds keeping the payload deterministic and small (spec §9.1, §9.3). */
export const MAX_REPORT_DATE_RANGE_DAYS = 1096; // ~3 years
export const MAX_REPORT_ROWS = 1000;

const balanceReportInput = z.object({
  memberBusinessId: z
    .string()
    .min(1)
    .describe(
      'The business to report on — must be one of the businesses you are a member of. ' +
        'Unlike the list tools this report covers exactly one business, so the id is required. ' +
        'Use accounter_list_business_memberships to discover ids.',
    ),
  fromDate: TIMELESS_DATE.describe('Start of the reporting period (YYYY-MM-DD).'),
  toDate: TIMELESS_DATE.describe('End of the reporting period (YYYY-MM-DD).'),
  reportType: z
    .enum(['BALANCE'])
    .optional()
    .default('BALANCE')
    .describe('Report type. Only BALANCE is supported in phase 1.'),
});

type BalanceReportInput = z.infer<typeof balanceReportInput>;

const BALANCE_REPORT_QUERY = /* GraphQL */ `
  query McpBalanceReport($fromDate: TimelessDate!, $toDate: TimelessDate!, $ownerId: UUID) {
    transactionsForBalanceReport(fromDate: $fromDate, toDate: $toDate, ownerId: $ownerId) {
      id
      chargeId
      date
      isFee
      description
      amount {
        raw
        formatted
        currency
      }
    }
  }
`;

function assertDateRange(input: BalanceReportInput): void {
  const from = parseCalendarDate(input.fromDate);
  const to = parseCalendarDate(input.toDate);
  if (from === null || to === null) {
    throw new ToolInputError('Invalid fromDate/toDate');
  }
  if (from > to) {
    throw new ToolInputError('fromDate must be on or before toDate');
  }
  if (Math.round((to - from) / DAY_MS) > MAX_REPORT_DATE_RANGE_DAYS) {
    throw new ToolInputError(`Date range must not exceed ${MAX_REPORT_DATE_RANGE_DAYS} days`);
  }
}

async function handler(
  input: BalanceReportInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  assertDateRange(input);

  // Report on the business the caller actually asked for. Deriving the owner
  // from the scope instead (`readScope.memberBusinessIds[0]`) happens to agree today
  // only because the policy narrows the scope to exactly this one business — it
  // would silently report on the wrong business the moment the scope can hold
  // more than one entry.
  //
  // The membership check is defense in depth: the policy has already verified
  // this business is in scope, so a mismatch means the two disagree, and a
  // business-scoped tool must never reach upstream with an unauthorized owner.
  const ownerId = input.memberBusinessId;
  if (!context.readScope.memberBusinessIds.includes(ownerId)) {
    throw new ToolInputError('No authorized business in scope for this report');
  }

  const variables: McpBalanceReportQueryVariables = {
    fromDate: input.fromDate,
    toDate: input.toDate,
    ownerId,
  };
  const data = await context.client.query<McpBalanceReportQuery>(
    { query: BALANCE_REPORT_QUERY, variables },
    context.upstream,
  );

  // Defend against a null/absent list from a nullable upstream field.
  const all = data.transactionsForBalanceReport ?? [];
  const rows = all.slice(0, MAX_REPORT_ROWS).map(row => ({
    id: row.id,
    chargeId: row.chargeId,
    ownerId,
    date: row.date,
    isFee: row.isFee,
    description: row.description,
    amount: normalizeAmount(row.amount),
  }));

  return shapeListResult({
    items: rows,
    itemsKey: 'rows',
    total: all.length,
    extra: {
      reportType: input.reportType,
      memberBusinessId: ownerId,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
      period: { fromDate: input.fromDate, toDate: input.toDate },
    },
    summarize: (shown, total) =>
      `Balance report for ${input.fromDate}–${input.toDate}: ${total} transaction(s)${
        shown < total ? ` (showing ${shown})` : ''
      }.`,
  });
}

export const balanceReportTool: ToolDefinition<typeof balanceReportInput> = {
  name: BALANCE_REPORT_TOOL_NAME,
  description:
    'Generate a read-only balance report (transactions) for one of your businesses over a bounded date range. Every row carries the owning business as `ownerId`. Requires business owner or accountant role. ' +
    resultEnvelopeDescription('rows') +
    ' ' +
    SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: balanceReportInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
  },
  handler,
};
