import { z } from 'zod';
import type { McpSearchChargesQuery, McpSearchChargesQueryVariables } from '../gql/index.js';
import { DAY_MS, parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { ToolInputError } from './execute.js';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { businessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

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

const searchChargesInput = z.object({
  businessIds: businessIdsInput,
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
        owner {
          id
          name
        }
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

/** A single charge node as returned by the generated `McpSearchCharges` query. */
type RawCharge = McpSearchChargesQuery['allCharges']['nodes'][number];

/** Normalized charge shape returned to the caller. */
export interface NormalizedCharge {
  id: string;
  description: string | null;
  /** Owning business, so multi-business results can be grouped by the model. */
  ownerId: string | null;
  ownerName: string | null;
  amount: { value: number; formatted: string; currency: string } | null;
  date: string | null;
}

/** Reject an invalid, inverted, or too-wide date range before hitting upstream. */
function assertDateRange(input: SearchChargesInput): void {
  // Validate each supplied date even when only one is present — a value can
  // match the format regex yet be an impossible calendar date (e.g. 2026-02-31).
  let from: number | undefined;
  let to: number | undefined;
  if (input.fromDate !== undefined) {
    const parsed = parseCalendarDate(input.fromDate);
    if (parsed === null) {
      throw new ToolInputError('Invalid fromDate');
    }
    from = parsed;
  }
  if (input.toDate !== undefined) {
    const parsed = parseCalendarDate(input.toDate);
    if (parsed === null) {
      throw new ToolInputError('Invalid toDate');
    }
    to = parsed;
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

function buildFilters(
  input: SearchChargesInput,
  businessIds: readonly string[],
): NonNullable<McpSearchChargesQueryVariables['filters']> {
  const filters: NonNullable<McpSearchChargesQueryVariables['filters']> = {
    chargesType: input.flow,
  };
  // Always scope to the authorized businesses — by OWNER, not counterparty.
  //
  // `byOwners` is the owner predicate (`c.owner_id IN $ownerIds`). `byBusinesses`
  // is the *counterparty* predicate (`ec.business_array && $ids`), and upstream
  // builds that array as `array_remove(base.business_array, fc.owner_id)` — the
  // owner is explicitly removed from it. Filtering by `byBusinesses` therefore
  // matched only charges where an authorized business appears as the *other*
  // party, i.e. inter-company charges: a small and wrong slice of the results.
  //
  // Kept as an explicit predicate even though `x-business-scope` now narrows via
  // RLS upstream: defense in depth, and the tool stays correct if upstream ever
  // runs under a scope-bypassing role.
  if (businessIds.length > 0) {
    filters.byOwners = [...businessIds];
  }
  if (input.fromDate) filters.fromDate = input.fromDate;
  if (input.toDate) filters.toDate = input.toDate;
  if (input.tags && input.tags.length > 0) filters.byTags = [...input.tags];
  if (input.freeText) filters.freeText = input.freeText;
  return filters;
}

function normalizeCharge(charge: RawCharge): NormalizedCharge {
  return {
    id: charge.id,
    description: charge.userDescription,
    // Optional chaining: fixtures predating owner selection omit the field.
    ownerId: charge.owner?.id ?? null,
    ownerName: charge.owner?.name ?? null,
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

  const variables: McpSearchChargesQueryVariables = {
    filters: buildFilters(input, context.readScope.businessIds),
    // The tool exposes a 1-based `page`, but upstream `allCharges` is 0-based
    // (it slices `[page * limit, (page + 1) * limit]`), so translate here —
    // otherwise page 1 would skip the first page of results.
    page: input.page - 1,
    limit: input.pageSize,
  };
  const data = await context.client.query<McpSearchChargesQuery>(
    { query: SEARCH_CHARGES_QUERY, variables },
    context.upstream,
  );

  const charges = data.allCharges.nodes.map(normalizeCharge);
  const { pageInfo } = data.allCharges;
  const pagination = {
    page: pageInfo.currentPage ?? input.page,
    pageSize: pageInfo.pageSize ?? input.pageSize,
    totalPages: pageInfo.totalPages,
    hasNextPage: (pageInfo.currentPage ?? input.page) < pageInfo.totalPages,
  };

  const scope = { businessIds: context.readScope.businessIds };
  // The text content is what the model reads first, so surface a multi-business
  // result there — otherwise a union across businesses looks like a single-
  // business answer until the model inspects `scope` in the structured payload.
  const scopeNote =
    scope.businessIds.length > 1 ? ` across ${scope.businessIds.length} businesses` : '';

  return shapeListResult({
    items: charges,
    itemsKey: 'charges',
    total: pageInfo.totalRecords,
    extra: { pagination, scope },
    summarize: (shown, total) =>
      total === 0
        ? `No charges matched the given filters${scopeNote}.`
        : `Found ${total} charge(s)${scopeNote}; showing ${shown} on page ${pagination.page} of ${pagination.totalPages}.`,
  });
}

export const searchChargesTool: ToolDefinition<typeof searchChargesInput> = {
  name: SEARCH_CHARGES_TOOL_NAME,
  description:
    'Search and browse accounting charges within your authorized businesses. Supports date range, tag, free-text, and income/expense filters with bounded pagination. Read-only. ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: searchChargesInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
