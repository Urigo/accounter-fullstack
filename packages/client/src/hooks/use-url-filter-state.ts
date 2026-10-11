import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocation } from 'react-router-dom';
import type { z } from 'zod';
import { areFiltersEqual, decodeFilters, encodeFilters } from '@/router/routes.js';

/**
 * A page filter persisted in a URL parameter (via `encodeFilters` / `decodeFilters`), so a
 * filtered view can be linked to, survives a reload, and follows browser back / forward.
 *
 * `schema` must keep its identity across renders (declare it at module level): the URL write
 * below must not re-run on a render where only the navigation changed.
 *
 * Store normalized filters (`normalizeFilter`) through the setter, and keep the current object
 * when nothing changed: the state is only replaced when its contents differ, so query variables
 * derived from it stay stable.
 */
export function useUrlFilterState<T extends object>(
  param: string,
  schema: z.ZodType<T>,
): [Partial<T>, Dispatch<SetStateAction<Partial<T>>>] {
  const location = useLocation();

  // Read from `window.location` rather than the router: the filter is written with a bare
  // `history.pushState` (as `useUrlQuery` does), which react-router never sees, so its copy of the
  // query string can lag behind the address bar.
  const readFilterFromUrl = useCallback(
    (): Partial<T> => decodeFilters(new URLSearchParams(window.location.search).get(param), schema),
    [param, schema],
  );

  const [filter, setFilter] = useState<Partial<T>>(readFilterFromUrl);

  // Re-sync whenever the URL changed under us. Comparing contents keeps the state object — and
  // with it the query variables — stable when the URL already matches.
  useEffect(() => {
    const syncFromUrl = (): void => {
      const fromUrl = readFilterFromUrl();
      setFilter(current => (areFiltersEqual(current, fromUrl) ? current : fromUrl));
    };
    syncFromUrl();
    // Browser back / forward. The router's location can't be relied on for this: it never saw our
    // own writes, so going back to the entry it last knew (say, the one the page was loaded on)
    // hands out a location equal to the current one, and it doesn't re-render.
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
    };
    // `location` covers in-app navigations (a link to this page with another filter).
  }, [location, readFilterFromUrl]);

  // Depends on `filter` alone (`param` and `schema` are fixed) — never on a per-render callback
  // such as `useUrlQuery().set`. A back / forward render still holds the previous filter (the effect above
  // only schedules the new one), and writing it then would push a stale entry over the one just
  // navigated to — and drop the forward history with it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const current = params.get(param);
    const encoded = encodeFilters(filter);
    if (encoded === current) {
      return;
    }
    // The URL already holds this filter, just spelled differently (key order, nulls, a link from
    // before normalization): canonicalize it in place rather than adding a history entry.
    const sameFilter = areFiltersEqual(filter, decodeFilters(current, schema));
    if (encoded) {
      params.set(param, encoded);
    } else {
      params.delete(param);
    }
    const search = params.toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
    if (sameFilter) {
      window.history.replaceState(window.history.state, '', url);
    } else {
      window.history.pushState({ path: url }, '', url);
    }
  }, [filter, param, schema]);

  return [filter, setFilter];
}
