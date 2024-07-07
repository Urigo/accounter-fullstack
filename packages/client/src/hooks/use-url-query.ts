import { useLocation } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

type UseUrlQuery = {
  query: URLSearchParams;
  queryString: () => string;
  get: (key: string) => string | null;
  set: (key: string, value?: string | null) => void;
};

export function useUrlQuery(): UseUrlQuery {
  const { search } = useLocation();

  const query = useMemo(() => new URLSearchParams(search), [search]);

  const updateUrl = useCallback(() => {
    if (window.history.pushState) {
      const params = query.keys().next().done ? '' : `?${query.toString()}`;
      const newurl =
        window.location.protocol + '//' + window.location.host + window.location.pathname + params;
      window.history.pushState({ path: newurl }, '', newurl);
    }
  }, [query]);

  return {
    query,
    queryString: (): string => query.toString(),
    get: (key: string): string | null => query?.get(key),
    set: (key: string, value?: string | null): void => {
      if (value == null) {
        query.delete(key);
      } else {
        query.set(key, value);
      }
      updateUrl();
    },
  };
}
