import { z } from 'zod';
import type { McpSearchChargesQuery, McpSearchChargesQueryVariables } from '../gql/index.js';
import {
  buildChargeFilters,
  CHARGE_FILTER_SHAPE,
  type ChargeFiltersInput,
} from './charge-filters.js';
import { DAY_MS, parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { chargeTypeFromTypename, normalizeAmount, type NormalizedAmount } from './entity-shapes.js';
import { ToolInputError } from './execute.js';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { memberBusinessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Tool 1: read-only charges search/browse (spec §8.2).
 *
 * Results are always scoped to the caller's authorized businesses (the resolved
 * read scope), with bounded pagination and a bounded date range.
 */

export const SEARCH_CHARGES_TOOL_NAME = 'accounter_search_charges';

/** Hard caps to keep responses bounded (spec §9.1, §9.3). */
export const MAX_PAGE_SIZE = 500;
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_DATE_RANGE_DAYS = 1096; // ~3 years

/**
 * Upstream `ChargeFilter` fields this tool exposes under a friendlier name,
 * mapped `upstream field → tool input field`.
 *
 * Everything else in `CHARGE_FILTER_SHAPE` is spread in below under its upstream
 * name, so every predicate `accounter_get_charges` accepts is reachable here
 * too. The aliases are the fields that predate the shared shape and stay put:
 * renaming `flow`/`tags` would break callers for no gain, and this tool's
 * `fromDate`/`toDate` have always meant the *overlap* pair
 * (`fromAnyDate`/`toAnyDate`) — quietly repointing them at the narrower
 * containment predicate would change which charges an existing query returns
 * without saying so. The containment pair is exposed as
 * `fromMainDate`/`toMainDate` instead.
 *
 * The schema-contract test reads this map, so a `ChargeFilter` field that is
 * neither spread in nor aliased here fails the suite rather than going missing.
 */
export const SEARCH_CHARGES_FILTER_ALIASES = {
  chargesType: 'flow',
  byTags: 'tags',
  byOwners: 'memberBusinessIds',
  fromAnyDate: 'fromDate',
  toAnyDate: 'toDate',
  fromDate: 'fromMainDate',
  toDate: 'toMainDate',
} as const;

// The aliased fields are pulled out of the shared shape so they cannot also
// appear under their upstream name — two spellings of one predicate in a single
// input object is exactly the ambiguity the alias map exists to avoid.
const {
  chargesType: _chargesType,
  byTags: _byTags,
  byOwners: _byOwners,
  fromAnyDate: _fromAnyDate,
  toAnyDate: _toAnyDate,
  fromDate: _fromDate,
  toDate: _toDate,
  ...PASS_THROUGH_CHARGE_FILTERS
} = CHARGE_FILTER_SHAPE;

const searchChargesInput = z.object({
  memberBusinessIds: memberBusinessIdsInput,
  fromDate: TIMELESS_DATE.optional().describe(
    'Only charges with *any* date (document, transaction event/debit, ledger) on/after this date ' +
      '(YYYY-MM-DD) — the overlap predicate, i.e. "charges active in this period". For the narrower ' +
      '"charges belonging to this period" test, use `fromMainDate`.',
  ),
  toDate: TIMELESS_DATE.optional().describe(
    'Only charges with *any* date (document, transaction event/debit, ledger) on/before this date ' +
      '(YYYY-MM-DD). See `toMainDate` for the narrower containment test.',
  ),
  fromMainDate: TIMELESS_DATE.optional().describe(
    'Only charges whose main date (documents min date, else transactions min event date) is on/after ' +
      'this date (YYYY-MM-DD). Narrower than `fromDate`.',
  ),
  toMainDate: TIMELESS_DATE.optional().describe(
    'Only charges whose main date (documents max date, else transactions max event date) is on/before ' +
      'this date (YYYY-MM-DD). Narrower than `toDate`.',
  ),
  tags: z.array(z.string().min(1)).max(20).optional().describe('Only charges carrying these tags.'),
  flow: z
    .enum(['ALL', 'INCOME', 'EXPENSE'])
    .optional()
    .default('ALL')
    .describe('Restrict to income or expense charges.'),
  // Every remaining ChargeFilter predicate, under its upstream name: freeText,
  // accountantStatus, byBusinesses, byBusinessTrips, byChargeTypes, sortBy, and
  // the without*/with* flags.
  ...PASS_THROUGH_CHARGE_FILTERS,
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
});

type SearchChargesInput = z.infer<typeof searchChargesInput>;

const SEARCH_CHARGES_QUERY = /* GraphQL */ `
  query McpSearchCharges($filters: ChargeFilter, $page: Int!, $limit: Int!) {
    allCharges(filters: $filters, page: $page, limit: $limit) {
      nodes {
        __typename
        id
        ownerId
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
  /** Same vocabulary as `filters.byChargeTypes`, so it can be fed back as a filter. */
  chargeType: string | null;
  /** Owning business, so multi-business results can be grouped by the model. */
  ownerId: string | null;
  ownerName: string | null;
  amount: NormalizedAmount | null;
  date: string | null;
}

/**
 * Reject an invalid, inverted, or too-wide date range before hitting upstream.
 *
 * Applied to each date pair independently — the overlap pair (`fromDate`/
 * `toDate`) and the containment pair (`fromMainDate`/`toMainDate`) — so a bad
 * bound is caught whichever pair it was passed in, and the error names the field
 * the caller actually used.
 */
function assertDatePair(
  fromValue: string | undefined,
  toValue: string | undefined,
  fromField: string,
  toField: string,
): void {
  // Validate each supplied date even when only one is present — a value can
  // match the format regex yet be an impossible calendar date (e.g. 2026-02-31).
  let from: number | undefined;
  let to: number | undefined;
  if (fromValue !== undefined) {
    const parsed = parseCalendarDate(fromValue);
    if (parsed === null) {
      throw new ToolInputError(`Invalid ${fromField}`);
    }
    from = parsed;
  }
  if (toValue !== undefined) {
    const parsed = parseCalendarDate(toValue);
    if (parsed === null) {
      throw new ToolInputError(`Invalid ${toField}`);
    }
    to = parsed;
  }
  if (from !== undefined && to !== undefined) {
    if (from > to) {
      throw new ToolInputError(`${fromField} must be on or before ${toField}`);
    }
    if (Math.round((to - from) / DAY_MS) > MAX_DATE_RANGE_DAYS) {
      throw new ToolInputError(`Date range must not exceed ${MAX_DATE_RANGE_DAYS} days`);
    }
  }
}

function assertDateRange(input: SearchChargesInput): void {
  assertDatePair(input.fromDate, input.toDate, 'fromDate', 'toDate');
  assertDatePair(input.fromMainDate, input.toMainDate, 'fromMainDate', 'toMainDate');
}

/**
 * Newest charges first.
 *
 * Upstream `allCharges` defaults to *ascending* when no `sortBy` is supplied
 * (`asc: filters?.sortBy?.asc !== false`), so an unsorted request returns the
 * oldest rows in the database — for a broad question that is the least useful
 * page there is. Ask for descending explicitly rather than relying on a default
 * that points the wrong way.
 */
const SORT_NEWEST_FIRST = { field: 'DATE', asc: false } as const;

/**
 * Translate this tool's flat input into the shared `ChargeFilter` shape, then
 * build the upstream filter with the same builder `accounter_get_charges` uses.
 *
 * Owner scoping goes through `byOwners`, never `byBusinesses`: `byOwners` is the
 * owner predicate (`c.owner_id IN $ownerIds`), while `byBusinesses` is the
 * *counterparty* predicate (`ec.business_array && $ids`) — and upstream builds
 * that array as `array_remove(base.business_array, fc.owner_id)`, with the owner
 * explicitly removed. Filtering by `byBusinesses` therefore matched only charges
 * where an authorized business is the *other* party (inter-company charges): a
 * small and wrong slice. `buildChargeFilters` always sets `byOwners` from the
 * resolved scope, which keeps that defense-in-depth predicate in place even
 * though `x-business-scope` also narrows via RLS upstream.
 *
 * `byBusinesses` remains available as an explicit *counterparty* filter — the
 * caller opts into it knowingly; it is never used for scoping.
 */
function buildFilters(
  input: SearchChargesInput,
  memberBusinessIds: readonly string[],
): NonNullable<McpSearchChargesQueryVariables['filters']> {
  const {
    flow,
    tags,
    fromDate,
    toDate,
    fromMainDate,
    toMainDate,
    memberBusinessIds: _requestedMemberBusinessIds,
    page: _page,
    pageSize: _pageSize,
    ...passThrough
  } = input;

  const filters: ChargeFiltersInput = {
    ...passThrough,
    chargesType: flow,
    // Default to newest-first: upstream `allCharges` sorts *ascending* when no
    // `sortBy` is given (`asc: filters?.sortBy?.asc !== false`), so an unsorted
    // request answers a broad question with the oldest rows in the database.
    // A caller-supplied `sortBy` wins.
    sortBy: passThrough.sortBy ?? SORT_NEWEST_FIRST,
    ...(tags && tags.length > 0 ? { byTags: [...tags] } : {}),
    ...(fromDate ? { fromAnyDate: fromDate } : {}),
    ...(toDate ? { toAnyDate: toDate } : {}),
    ...(fromMainDate ? { fromDate: fromMainDate } : {}),
    ...(toMainDate ? { toDate: toMainDate } : {}),
  };

  return buildChargeFilters(filters, memberBusinessIds) as NonNullable<
    McpSearchChargesQueryVariables['filters']
  >;
}

function normalizeCharge(charge: RawCharge): NormalizedCharge {
  return {
    id: charge.id,
    description: charge.userDescription,
    chargeType: chargeTypeFromTypename(charge.__typename),
    // Optional chaining: fixtures predating owner selection omit the field.
    ownerId: charge.ownerId,
    ownerName: charge.owner?.name ?? null,
    amount: normalizeAmount(charge.totalAmount),
    date: charge.minEventDate,
  };
}

async function handler(
  input: SearchChargesInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  assertDateRange(input);

  const variables: McpSearchChargesQueryVariables = {
    filters: buildFilters(input, context.readScope.memberBusinessIds),
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

  const scope = { memberBusinessIds: context.readScope.memberBusinessIds };
  // The text content is what the model reads first, so surface a multi-business
  // result there — otherwise a union across businesses looks like a single-
  // business answer until the model inspects `scope` in the structured payload.
  const scopeNote =
    scope.memberBusinessIds.length > 1
      ? ` across ${scope.memberBusinessIds.length} businesses`
      : '';

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
    'Search and browse accounting charges within your authorized businesses. Supports every ChargeFilter predicate — date ranges (overlap via `fromDate`/`toDate`, containment via `fromMainDate`/`toMainDate`), tags, free text, income/expense, charge types, counterparties, business trips, accountant status, ordering, and the missing-document/transaction/ledger flags — with bounded pagination. Each row carries `chargeType`, so money moving between your own accounts can be excluded without inspecting descriptions. Read-only. ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: searchChargesInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
