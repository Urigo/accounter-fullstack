import { z } from 'zod';
import { ToolInputError } from './execute.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';

/**
 * Tool 3: a selected read-only report (spec §8.2).
 *
 * Phase 1 exposes one report — the balance report — for a single authorized
 * business over a bounded date range. Output rows are capped to avoid large
 * unbounded payloads. Role-gated to business owners / accountants.
 */

export const BALANCE_REPORT_TOOL_NAME = 'accounter_balance_report';

/** Bounds keeping the payload deterministic and small (spec §9.1, §9.3). */
export const MAX_REPORT_DATE_RANGE_DAYS = 366;
export const MAX_REPORT_ROWS = 500;

const TIMELESS_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const balanceReportInput = z.object({
  businessId: z
    .string()
    .min(1)
    .describe('The business to report on (must be one of your memberships).'),
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

interface RawBalanceRow {
  id: string;
  chargeId: string;
  date: string;
  isFee: boolean;
  description: string | null;
  amount: { raw: number; formatted: string; currency: string };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function assertDateRange(input: BalanceReportInput): void {
  const from = Date.parse(input.fromDate);
  const to = Date.parse(input.toDate);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new ToolInputError('Invalid fromDate/toDate');
  }
  if (from > to) {
    throw new ToolInputError('fromDate must be on or before toDate');
  }
  if ((to - from) / DAY_MS > MAX_REPORT_DATE_RANGE_DAYS) {
    throw new ToolInputError(`Date range must not exceed ${MAX_REPORT_DATE_RANGE_DAYS} days`);
  }
}

async function handler(
  input: BalanceReportInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  assertDateRange(input);

  // Policy has already confirmed the requested business is within scope; use the
  // narrowed scope as the single owner. Assert defensively — a business-scoped
  // tool must never reach upstream without a concrete owner.
  const ownerId = context.readScope.businessIds[0];
  if (!ownerId) {
    throw new ToolInputError('No authorized business in scope for this report');
  }

  const data = await context.client.query<{ transactionsForBalanceReport: RawBalanceRow[] }>(
    {
      query: BALANCE_REPORT_QUERY,
      variables: { fromDate: input.fromDate, toDate: input.toDate, ownerId },
    },
    { correlationId: context.correlationId, authorization: context.authorization },
  );

  // Defend against a null/absent list from a nullable upstream field.
  const all = data.transactionsForBalanceReport ?? [];
  const truncated = all.length > MAX_REPORT_ROWS;
  const rows = all.slice(0, MAX_REPORT_ROWS).map(row => ({
    id: row.id,
    chargeId: row.chargeId,
    date: row.date,
    isFee: row.isFee,
    description: row.description,
    amount: {
      value: row.amount.raw,
      formatted: row.amount.formatted,
      currency: row.amount.currency,
    },
  }));

  return {
    content: [
      {
        type: 'text',
        text: `Balance report for ${input.fromDate}–${input.toDate}: ${all.length} transaction(s)${
          truncated ? ` (showing first ${MAX_REPORT_ROWS})` : ''
        }.`,
      },
    ],
    structuredContent: {
      reportType: input.reportType,
      businessId: ownerId,
      period: { fromDate: input.fromDate, toDate: input.toDate },
      rows,
      rowCount: all.length,
      truncated,
    },
  };
}

export const balanceReportTool: ToolDefinition<typeof balanceReportInput> = {
  name: BALANCE_REPORT_TOOL_NAME,
  description:
    'Generate a read-only balance report (transactions) for one of your businesses over a bounded date range. Requires business owner or accountant role.',
  inputSchema: balanceReportInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
  },
  handler,
};
