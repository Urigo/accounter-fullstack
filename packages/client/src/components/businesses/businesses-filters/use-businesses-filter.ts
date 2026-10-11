import type { Dispatch, SetStateAction } from 'react';
import { useUrlFilterState } from '@/hooks/use-url-filter-state.js';
import {
  BUSINESSES_FILTER_PARAM,
  businessesPageFilterSchema,
  type BusinessesPageFilter,
} from './schema.js';

/**
 * The businesses page filter, persisted in the `businessesFilters` URL parameter so a filtered
 * view can be linked to and survives a reload.
 */
export function useBusinessesFilter(): [
  BusinessesPageFilter,
  Dispatch<SetStateAction<BusinessesPageFilter>>,
] {
  return useUrlFilterState<BusinessesPageFilter>(
    BUSINESSES_FILTER_PARAM,
    businessesPageFilterSchema,
  );
}
