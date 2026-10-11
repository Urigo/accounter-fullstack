import type { Dispatch, SetStateAction } from 'react';
import type { ChargeFilter } from '../../../gql/graphql.js';
import { useUrlFilterState } from '../../../hooks/use-url-filter-state.js';
import { chargeFilterUrlSchema, CHARGES_FILTER_PARAM } from './schema.js';

// A new filter starts over from the first page.
const RESET_ON_FILTER_CHANGE = ['page'] as const;

/**
 * The charges filter, persisted in the `chargesFilters` URL parameter so a filtered view can be
 * linked to, survives a reload, and follows back / forward. An empty filter means none was
 * applied: every filter the dialog applies carries at least its sort order.
 */
export function useChargesFilter(): [ChargeFilter, Dispatch<SetStateAction<ChargeFilter>>] {
  return useUrlFilterState<ChargeFilter>(CHARGES_FILTER_PARAM, chargeFilterUrlSchema, {
    resetParams: RESET_ON_FILTER_CHANGE,
  });
}
