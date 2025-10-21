import { useEffect, type ReactElement } from 'react';
import { useMatches } from 'react-router-dom';

interface RouteHandle {
  title?: string | ((data?: unknown) => string);
  breadcrumb?: string | ((data?: unknown) => string);
  [key: string]: unknown;
}

/**
 * Component that updates document title based on route handle
 * Place this in the root layout to automatically update titles
 */
export function DocumentTitle(): ReactElement | null {
  const matches = useMatches();

  useEffect(() => {
    const lastMatch = matches[matches.length - 1];
    const handle = lastMatch?.handle as RouteHandle | undefined;

    if (handle?.title) {
      const title =
        typeof handle.title === 'function' ? handle.title(lastMatch.data) : handle.title;
      document.title = `${title} - Accounter`;
    } else {
      document.title = 'Accounter';
    }
  }, [matches]);

  return null;
}
