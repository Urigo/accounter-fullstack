import type { ChargeFilter } from '../../gql/graphql';

export const getBusinessHref = (businessID: string, encodedFilters: string): string => {
  const currentFilters = encodedFilters
    ? (JSON.parse(decodeURIComponent(encodedFilters)) as ChargeFilter)
    : {};
  const encodedNewFilters = {
    fromDate: currentFilters.fromDate
      ? `%252C%2522fromDate%2522%253A%2522${currentFilters.fromDate}%2522`
      : '',
    toDate: currentFilters.toDate
      ? `%252C%2522toDate%2522%253A%2522${currentFilters.toDate}%2522`
      : '',
    financialEntityIds:
      currentFilters.byOwners && currentFilters.byOwners.length > 0
        ? `%2522${currentFilters.byOwners.join('%2522%252C%2522')}%2522`
        : '',
  };
  return `/business-transactions?transactionsFilters=%257B%2522financialEntityIds%2522%253A%255B${
    encodedNewFilters.financialEntityIds
  }%255D%252C%2522businessIDs%2522%253A%255B%2522${encodeURIComponent(businessID)}%2522%255D${
    encodedNewFilters.fromDate
  }${encodedNewFilters.toDate}%257D`;
};
