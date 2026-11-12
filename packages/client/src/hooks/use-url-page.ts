import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** A zero-based page index from its URL parameter; anything but a non-negative integer is 0. */
export function parsePageParam(value: string | null): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 0;
}

/**
 * A zero-based page index persisted in a URL parameter (omitted on the first page), so it
 * survives a reload and follows browser back / forward.
 *
 * Read straight from the router's location rather than mirrored into state: there is nothing to
 * keep in sync, so a back / forward navigation can't race a write. Written through the router, as
 * `useUrlFilterState` does (see there for why); pair it with that hook's `resetParams` to go back
 * to the first page when the filter changes.
 */
export function useUrlPage(param = 'page'): [number, Dispatch<SetStateAction<number>>] {
  const navigate = useNavigate();
  const page = parsePageParam(new URLSearchParams(useLocation().search).get(param));

  const setPage = useCallback<Dispatch<SetStateAction<number>>>(
    value => {
      // `window.location`, so parameters other code wrote with a bare `pushState` are kept.
      const params = new URLSearchParams(window.location.search);
      const current = parsePageParam(params.get(param));
      const next = typeof value === 'function' ? value(current) : value;
      if (next === current) {
        return;
      }
      if (next > 0) {
        params.set(param, String(next));
      } else {
        params.delete(param);
      }
      const search = params.toString();
      void navigate(
        { search: search ? `?${search}` : '', hash: window.location.hash },
        { preventScrollReset: true },
      );
    },
    [navigate, param],
  );

  return [page, setPage];
}
