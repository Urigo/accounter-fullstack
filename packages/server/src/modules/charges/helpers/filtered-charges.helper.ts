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

  const charges = await injector
    .get(ChargesProvider)
    .getChargesByFilters({
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
      freeText: filters?.freeText?.trim().toLowerCase(),
      tags: filters?.byTags,
      accountantStatuses: filters?.accountantStatus as accountant_statusArray | undefined,
    })
    .catch(error => {
      throw errorSimplifier('Error fetching charges', error);
    });

  // charge __typename is resolved dynamically, so filter by concrete type post-fetch
  let filteredCharges = charges;
  if (filters?.byChargeTypes?.length) {
    const wantedTypes = new Set<ChargeTypeEnum>(filters.byChargeTypes?.map(normalizeDbType));
    const chargeTypes = await Promise.all(
      charges.map(charge =>
        getChargeType(charge, injector).catch(error => {
          throw errorSimplifier('Failed to determine charge type', error);
        }),
      ),
    );
    filteredCharges = charges.filter((_, index) => wantedTypes.has(chargeTypes[index]));
  }

  const pageCharges = filteredCharges.slice(page * limit, (page + 1) * limit);

  return {
    __typename: 'PaginatedCharges',
    nodes: pageCharges,
    pageInfo: {
      totalPages: Math.ceil(filteredCharges.length / limit),
      totalRecords: filteredCharges.length,
    },
  };
}
