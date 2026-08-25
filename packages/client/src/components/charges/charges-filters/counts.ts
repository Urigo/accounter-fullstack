import { ChargeFilterType } from '../../../gql/graphql.js';
import type { ChargeFilterFormValues } from './schema.js';

/**
 * Permissive enough for both the form values (`undefined`) and the generated
 * `ChargeFilter` (`| null | undefined`), so the accordion pills, the modal header
 * count and the trigger badge all share one implementation.
 *
 * `sortBy` is omitted rather than widened: it is never counted, and the two types
 * disagree on whether `asc` is optional.
 */
export type CountableFilter = {
  [K in Exclude<keyof ChargeFilterFormValues, 'sortBy'>]?: ChargeFilterFormValues[K] | null;
};

export const COMPLETENESS_KEYS = [
  'withoutInvoice',
  'withoutReceipt',
  'withoutDocuments',
  'withoutTransactions',
  'withoutLedger',
  'withoutTags',
  'withOpenDocuments',
  'withMissingCounterparty',
  'unbalanced',
] as const;

export const countDates = (filter: CountableFilter): number =>
  (filter.fromAnyDate ? 1 : 0) + (filter.toAnyDate ? 1 : 0);

export const countEntities = (filter: CountableFilter): number =>
  (filter.byOwners?.length ?? 0) +
  (filter.byBusinesses?.length ?? 0) +
  (filter.excludedBusinesses?.length ?? 0) +
  (filter.byFinancialAccounts?.length ?? 0) +
  (filter.excludedFinancialAccounts?.length ?? 0) +
  (filter.byTags?.length ?? 0) +
  (filter.excludedTags?.length ?? 0) +
  (filter.byBusinessTrips?.length ?? 0);

export const countClassification = (filter: CountableFilter): number =>
  (filter.chargesType && filter.chargesType !== ChargeFilterType.All ? 1 : 0) +
  (filter.byChargeTypes?.length ?? 0) +
  (filter.accountantStatus?.length ?? 0);

export const countCompleteness = (filter: CountableFilter): number =>
  COMPLETENESS_KEYS.filter(key => filter[key]).length;

export const countFreeText = (filter: CountableFilter): number =>
  (filter.freeText ? 1 : 0) + (filter.excludedFreeText ? 1 : 0);

/** `sortBy` is deliberately never counted — it is always present. */
export const countActiveFilters = (filter: CountableFilter): number =>
  countDates(filter) +
  countEntities(filter) +
  countClassification(filter) +
  countCompleteness(filter) +
  countFreeText(filter);
