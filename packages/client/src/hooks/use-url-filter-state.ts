import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { areFiltersEqual, decodeFilters, encodeFilters } from '@/router/routes.js';

/**
 * A page filter persisted in a URL parameter (via `encodeFilters` / `decodeFilters`), so a
 * filtered view can be linked to, survives a reload, and follows browser back / forward.
 *
 * The URL is written through the router, never with a bare `history.pushState`: the router keeps
 * its own bookkeeping in each history entry's state, and an entry it didn't create throws off its
 * back / forward handling — and leaves `useLocation` behind the address bar. A write is a regular
 * navigation, so it re-runs the route's loaders, if it has any.
 *
 * `schema` (and `resetParams`) must keep their identity across renders (declare them at module
 * level): the URL write below must not re-run on a render where only the navigation changed.
 *
 * `resetParams` names parameters that only make sense for the current filter — typically the page
 * number — and are dropped in the same navigation that applies a new filter, so the two never
 * land in separate history entries.
 *
 * Store normalized filters (`normalizeFilter`) through the setter, and keep the current object
 * when nothing changed: the state is only replaced when its contents differ, so query variables
 * derived from it stay stable.
 */
export function useUrlFilterState<T extends object>(
  param: string,
  schema: z.ZodType<T>,
  { resetParams }: { resetParams?: readonly string[] } = {},
): [Partial<T>, Dispatch<SetStateAction<Partial<T>>>] {
  const navigate = useNavigate();
  const paramInUrl = new URLSearchParams(useLocation().search).get(param);

  const [filter, setFilter] = useState<Partial<T>>(() => decodeFilters(paramInUrl, schema));

  // Follow the URL when it changes under us: back / forward, or a link to this page with another
  // filter. Comparing contents keeps the state object — and with it the query variables — stable
  // when the URL already matches (as it does right after our own writes).
  useEffect(() => {
    const fromUrl = decodeFilters(paramInUrl, schema);
    setFilter(current => (areFiltersEqual(current, fromUrl) ? current : fromUrl));
  }, [paramInUrl, schema]);

  // Depends on `filter` alone (`navigate`, `param` and `schema` are stable) — never on the
  // location. A back / forward render still holds the previous filter (the effect above only
  // schedules the new one), and writing it then would push a stale entry over the one just
  // navigated to — and drop the forward history with it.
  useEffect(() => {
    // `window.location` rather than the router's copy, so parameters other code wrote with a bare
    // `pushState` (as `useUrlQuery` does) aren't dropped.
    const params = new URLSearchParams(window.location.search);
    const current = params.get(param);
    const encoded = encodeFilters(filter);
    if (encoded === current) {
      return;
    }
    // The URL already holds this filter, just spelled differently (key order, nulls, a link from
    // before normalization): canonicalize it in place rather than adding an entry.
    const canonicalizing = areFiltersEqual(filter, decodeFilters(current, schema));
    if (encoded) {
      params.set(param, encoded);
    } else {
      params.delete(param);
    }
    if (!canonicalizing) {
      for (const reset of resetParams ?? []) {
        params.delete(reset);
      }
    }
    const search = params.toString();
    void navigate(
      { search: search ? `?${search}` : '', hash: window.location.hash },
      { replace: canonicalizing, preventScrollReset: true },
    );
  }, [filter, navigate, param, schema, resetParams]);

  return [filter, setFilter];
}
