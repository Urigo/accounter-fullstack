import { useEffect } from 'react';
import { useMatches } from 'react-router-dom';
import type { RouteHandle } from '@/router/types.js';

/**
 * Component that updates document title based on route handle
 * Place this in the root layout to automatically update titles
 */
export function DocumentTitle() {
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

  return <div style={{ display: 'none' }} />;
}
