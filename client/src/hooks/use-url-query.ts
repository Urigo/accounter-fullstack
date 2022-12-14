import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export function useUrlQuery() {
  const { search } = useLocation();

  const query = useMemo(() => new URLSearchParams(search), [search]);

  const updateUrl = useCallback(() => {
    if (window.history.pushState) {
      const params = query.keys().next().done ? '' : `?${query.toString()}`;
      const newurl =
        window.location.protocol + '//' + window.location.host + window.location.pathname + params;
      window.history.pushState({ path: newurl }, '', newurl);
    }
  }, []);

  return {
    query,
    queryString: () => query.toString(),
    get: (key: string) => query.get(key),
    set: (key: string, value?: string | null) => {
      if (value == null) {
        query.delete(key);
      } else {
        query.set(key, value);
      }
      updateUrl();
    },
  };
}
