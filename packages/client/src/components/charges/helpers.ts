import type { ChargeFilter } from '../../gql/graphql.js';
import { getBusinessTransactionsHref } from '../business-transactions/index.js';

export const getBusinessHref = (businessID: string, encodedFilters: string): string => {
  const currentFilters = encodedFilters
    ? (JSON.parse(decodeURIComponent(encodedFilters)) as ChargeFilter)
    : {};

  return getBusinessTransactionsHref({
    fromDate: currentFilters.fromDate,
    toDate: currentFilters.toDate,
    ownerIds: currentFilters.byOwners,
    businessIDs: [businessID],
  });
};
