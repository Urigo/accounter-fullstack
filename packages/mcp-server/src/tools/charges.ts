import { z } from 'zod';
import { ToolInputError } from './execute.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';

/**
 * Tool 1: read-only charges search/browse (spec §8.2).
 *
 * Results are always scoped to the caller's authorized businesses (the resolved
 * read scope), with bounded pagination and a bounded date range.
 */

export const SEARCH_CHARGES_TOOL_NAME = 'accounter_search_charges';

/** Hard caps to keep responses bounded (spec §9.1, §9.3). */
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_DATE_RANGE_DAYS = 366;

const TIMELESS_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const searchChargesInput = z.object({
  businessIds: z
    .array(z.string().min(1))
    .max(50)
    .optional()
    .describe('Narrow results to these business ids (must be a subset of your memberships).'),
  fromDate: TIMELESS_DATE.optional().describe('Only charges on/after this date (YYYY-MM-DD).'),
  toDate: TIMELESS_DATE.optional().describe('Only charges on/before this date (YYYY-MM-DD).'),
  tags: z.array(z.string().min(1)).max(20).optional().describe('Only charges carrying these tags.'),
  freeText: z.string().min(1).max(200).optional().describe('Free-text search across the charge.'),
  flow: z
    .enum(['ALL', 'INCOME', 'EXPENSE'])
    .optional()
    .default('ALL')
    .describe('Restrict to income or expense charges.'),
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
});

type SearchChargesInput = z.infer<typeof searchChargesInput>;

const SEARCH_CHARGES_QUERY = /* GraphQL */ `
  query McpSearchCharges($filters: ChargeFilter, $page: Int!, $limit: Int!) {
    allCharges(filters: $filters, page: $page, limit: $limit) {
      nodes {
        id
        userDescription
        totalAmount {
          raw
          formatted
          currency
        }
        minEventDate
      }
      pageInfo {
        totalPages
        totalRecords
        currentPage
        pageSize
      }
    }
  }
`;

interface RawCharge {
  id: string;
  userDescription: string | null;
  totalAmount: { raw: number; formatted: string; currency: string } | null;
  minEventDate: string | null;
}

interface SearchChargesData {
  allCharges: {
    nodes: RawCharge[];
    pageInfo: {
      totalPages: number;
      totalRecords: number;
      currentPage: number | null;
      pageSize: number | null;
    };
  };
}

/** Normalized charge shape returned to the caller. */
export interface NormalizedCharge {
  id: string;
  description: string | null;
  amount: { value: number; formatted: string; currency: string } | null;
  date: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Reject an invalid, inverted, or too-wide date range before hitting upstream. */
function assertDateRange(input: SearchChargesInput): void {
  // Validate each supplied date even when only one is present — a value can
  // match the format regex yet be an impossible calendar date (e.g. 2026-02-31).
  const from = input.fromDate ? Date.parse(input.fromDate) : undefined;
  const to = input.toDate ? Date.parse(input.toDate) : undefined;
  if (from !== undefined && Number.isNaN(from)) {
    throw new ToolInputError('Invalid fromDate');
  }
  if (to !== undefined && Number.isNaN(to)) {
    throw new ToolInputError('Invalid toDate');
  }
  if (from !== undefined && to !== undefined) {
    if (from > to) {
      throw new ToolInputError('fromDate must be on or before toDate');
    }
    if (Math.round((to - from) / DAY_MS) > MAX_DATE_RANGE_DAYS) {
      throw new ToolInputError(`Date range must not exceed ${MAX_DATE_RANGE_DAYS} days`);
    }
  }
}

function buildFilters(input: SearchChargesInput, businessIds: readonly string[]) {
  const filters: Record<string, unknown> = { chargesType: input.flow };
  // Always scope to the authorized businesses.
  if (businessIds.length > 0) {
    filters.byBusinesses = [...businessIds];
  }
  if (input.fromDate) filters.fromDate = input.fromDate;
  if (input.toDate) filters.toDate = input.toDate;
  if (input.tags && input.tags.length > 0) filters.byTags = input.tags;
  if (input.freeText) filters.freeText = input.freeText;
  return filters;
}

function normalizeCharge(charge: RawCharge): NormalizedCharge {
  return {
    id: charge.id,
    description: charge.userDescription,
    amount: charge.totalAmount
      ? {
          value: charge.totalAmount.raw,
          formatted: charge.totalAmount.formatted,
          currency: charge.totalAmount.currency,
        }
      : null,
    date: charge.minEventDate,
  };
}

async function handler(
  input: SearchChargesInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  assertDateRange(input);

  const data = await context.client.query<SearchChargesData>(
    {
      query: SEARCH_CHARGES_QUERY,
      variables: {
        filters: buildFilters(input, context.readScope.businessIds),
        page: input.page,
        limit: input.pageSize,
      },
    },
    { correlationId: context.correlationId, authorization: context.authorization },
  );

  const charges = data.allCharges.nodes.map(normalizeCharge);
  const { pageInfo } = data.allCharges;
  const pagination = {
    page: pageInfo.currentPage ?? input.page,
    pageSize: pageInfo.pageSize ?? input.pageSize,
    totalPages: pageInfo.totalPages,
    totalRecords: pageInfo.totalRecords,
    hasNextPage: (pageInfo.currentPage ?? input.page) < pageInfo.totalPages,
  };

  const summary =
    charges.length === 0
      ? 'No charges matched the given filters.'
      : `Found ${pagination.totalRecords} charge(s); showing page ${pagination.page} of ${pagination.totalPages} (${charges.length} on this page).`;

  return {
    content: [{ type: 'text', text: summary }],
    structuredContent: { charges, pagination },
  };
}

export const searchChargesTool: ToolDefinition<typeof searchChargesInput> = {
  name: SEARCH_CHARGES_TOOL_NAME,
  description:
    'Search and browse accounting charges within your authorized businesses. Supports date range, tag, free-text, and income/expense filters with bounded pagination. Read-only.',
  inputSchema: searchChargesInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
