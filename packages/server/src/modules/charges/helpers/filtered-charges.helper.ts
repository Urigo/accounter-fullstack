import type { Injector } from 'graphql-modules';
import type { ChargeFilter } from '../../../__generated__/types.js';
import { ChargeSortByField, ChargeTypeEnum } from '../../../shared/enums.js';
import { errorSimplifier } from '../../../shared/errors.js';
import { ChargesProvider } from '../providers/charges.provider.js';
import type { accountant_statusArray, IGetChargesByFiltersResult } from '../types.js';
import { getChargeType, normalizeDbType } from './charge-type.js';

type PaginatedChargesResult = {
  __typename: 'PaginatedCharges';
  nodes: IGetChargesByFiltersResult[];
  pageInfo: {
    totalPages: number;
    totalRecords: number;
  };
};

type FetchFilteredChargesParams = {
  filters?: ChargeFilter | null;
  page: number;
  limit: number;
  /**
   * Narrows the result to these charge ids (on top of `filters`). An empty
   * array means "no charge qualifies" and short-circuits — the provider reads
   * an empty id list as "no id filter at all" and would return everything.
   */
  restrictToIds?: string[];
};

/**
 * Shared charge listing: maps a `ChargeFilter` onto the provider parameters,
 * applies the post-fetch concrete-type narrowing and paginates. Used by both
 * `allCharges` and `chargesWithMissingRequiredInfo` so the two screens offer
 * the exact same filter set.
 *
 * `page` is zero-based: page 0 is the first page.
 */
export async function fetchFilteredCharges(
  injector: Injector,
  { filters, page, limit, restrictToIds }: FetchFilteredChargesParams,
): Promise<PaginatedChargesResult> {
  const emptyResult: PaginatedChargesResult = {
    __typename: 'PaginatedCharges',
    nodes: [],
    pageInfo: { totalPages: 0, totalRecords: 0 },
  };

  if (restrictToIds?.length === 0) {
    return emptyResult;
  }

  // handle sort column
  let sortColumn: 'event_date' | 'event_amount' | 'abs_event_amount' = 'event_date';
  switch (filters?.sortBy?.field) {
    case ChargeSortByField.Amount:
      sortColumn = 'event_amount';
      break;
    case ChargeSortByField.AbsAmount:
      sortColumn = 'abs_event_amount';
      break;
    case ChargeSortByField.Date:
      sortColumn = 'event_date';
      break;
  }

  // The concrete-type filter is decided per charge in memory, after the query, so it needs every
  // matching charge and pages them here. Otherwise the database returns just the page.
  const isTypeFiltered = !!filters?.byChargeTypes?.length;
  const paging = isTypeFiltered ? {} : { limit, offset: page * limit };

  const fetchCharges = (window: { limit?: number; offset?: number }) =>
    injector
      .get(ChargesProvider)
      .getChargesByFilters({
        ...window,
        IDs: restrictToIds,
        ownerIds: filters?.byOwners,
        // Both date families are forwarded: `fromDate`/`toDate` test the
        // charge's main date (documents min/max, else transaction event
        // dates) — containment — while `fromAnyDate`/`toAnyDate` test whether
        // the charge's span across *all* date sources overlaps the range. The
        // SQL has always supported both; only the `*AnyDate` pair was wired
        // up here, so a caller passing `fromDate`/`toDate` (as the MCP charge
        // tools now can) got an unfiltered result instead of a narrower one.
        fromDate: filters?.fromDate,
        toDate: filters?.toDate,
        fromAnyDate: filters?.fromAnyDate,
        toAnyDate: filters?.toAnyDate,
        sortColumn,
        asc: filters?.sortBy?.asc !== false,
        chargeType: filters?.chargesType,
        businessIds: filters?.byBusinesses,
        businessTripIds: filters?.byBusinessTrips,
        accountIds: filters?.byFinancialAccounts,
        withMissingCounterparty: filters?.withMissingCounterparty,
        withoutInvoice: filters?.withoutInvoice,
        withoutReceipt: filters?.withoutReceipt,
        withoutDocuments: filters?.withoutDocuments,
        withOpenDocuments: filters?.withOpenDocuments,
        withoutTransactions: filters?.withoutTransactions,
        withoutLedger: filters?.withoutLedger,
        withoutTags: filters?.withoutTags,
        // `|| undefined` so a whitespace-only value never leaves the mapping layer as
        // an empty string, which SQL would read as ILIKE '%%'. The provider normalizes
        // again as the authoritative guard.
        freeText: filters?.freeText?.trim().toLowerCase() || undefined,
        tags: filters?.byTags,
        // Exclusions. A value present in both an include and its exclude list is
        // dropped: the predicates are ANDed, so exclude wins.
        excludedBusinessIds: filters?.excludedBusinesses,
        excludedAccountIds: filters?.excludedFinancialAccounts,
        excludedTags: filters?.excludedTags,
        excludedFreeText: filters?.excludedFreeText?.trim().toLowerCase() || undefined,
        accountantStatuses: filters?.accountantStatus as accountant_statusArray | undefined,
      })
      .catch(error => {
        throw errorSimplifier('Error fetching charges', error);
      });

  const charges = await fetchCharges(paging);

  if (!isTypeFiltered) {
    let totalRecords = charges.length ? Number(charges[0].total_count) : 0;
    // The total rides on the page's rows, so a page past the end (a stale `?page=` in the URL)
    // has none. Look the total up, so the list still shows its pages to go back to.
    if (!charges.length && page > 0) {
      const [first] = await fetchCharges({ limit: 1, offset: 0 });
      totalRecords = first ? Number(first.total_count) : 0;
    }
    return paginated(charges, totalRecords, limit);
  }

  // charge __typename is resolved dynamically, so filter by concrete type post-fetch
  const wantedTypes = new Set<ChargeTypeEnum>(filters!.byChargeTypes!.map(normalizeDbType));
  const chargeTypes = await Promise.all(
    charges.map(charge =>
      getChargeType(charge, injector).catch(error => {
        throw errorSimplifier('Failed to determine charge type', error);
      }),
    ),
  );
  const filteredCharges = charges.filter((_, index) => wantedTypes.has(chargeTypes[index]));

  return paginated(
    filteredCharges.slice(page * limit, (page + 1) * limit),
    filteredCharges.length,
    limit,
  );
}

function paginated(
  nodes: IGetChargesByFiltersResult[],
  totalRecords: number,
  limit: number,
): PaginatedChargesResult {
  return {
    __typename: 'PaginatedCharges',
    nodes,
    pageInfo: {
      totalPages: Math.ceil(totalRecords / limit),
      totalRecords,
    },
  };
}
