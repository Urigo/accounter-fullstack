import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocation } from 'react-router-dom';
import { encodeFilters } from '@/router/routes.js';
import {
  areFiltersEqual,
  BUSINESSES_FILTER_PARAM,
  parseBusinessesFilterParam,
  type BusinessesPageFilter,
} from './schema.js';

/**
 * Read from `window.location` rather than the router: the filter is written with a bare
 * `history.pushState` (as `useUrlQuery` does), which react-router never sees, so its copy of the
 * query string can lag behind the address bar.
 */
function readFilterFromUrl(): BusinessesPageFilter {
  return parseBusinessesFilterParam(
    new URLSearchParams(window.location.search).get(BUSINESSES_FILTER_PARAM),
  );
}

/**
 * The businesses page filter, persisted in the `businessesFilters` URL parameter so a filtered
 * view can be linked to and survives a reload.
 */
export function useBusinessesFilter(): [
  BusinessesPageFilter,
  Dispatch<SetStateAction<BusinessesPageFilter>>,
] {
  const location = useLocation();
  const [filter, setFilter] = useState<BusinessesPageFilter>(readFilterFromUrl);

  // Browser back / forward. react-router hands out a new location on every popstate; our own
  // writes bypass it (see above), so this only runs when the URL changed under us. Comparing
  // contents keeps the state object — and with it the query variables — stable when the URL
  // already matches.
  useEffect(() => {
    const fromUrl = readFilterFromUrl();
    setFilter(current => (areFiltersEqual(current, fromUrl) ? current : fromUrl));
  }, [location]);

  // Depends on `filter` alone. A back / forward render still holds the previous filter (the effect
  // above only schedules the new one), and writing it then would push a stale entry over the
  // one just navigated to — and drop the forward history with it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = encodeFilters(filter);
    if (encoded === params.get(BUSINESSES_FILTER_PARAM)) {
      return;
    }
    if (encoded) {
      params.set(BUSINESSES_FILTER_PARAM, encoded);
    } else {
      params.delete(BUSINESSES_FILTER_PARAM);
    }
    const search = params.toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
    window.history.pushState({ path: url }, '', url);
  }, [filter]);

  return [filter, setFilter];
}
