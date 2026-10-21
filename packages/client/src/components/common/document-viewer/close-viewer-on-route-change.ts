import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDocumentViewer } from '@/hooks/use-document-viewer.js';

/**
 * Closes the document viewer when the pathname changes. A filter or query-string change keeps it
 * open, since the page (and usually the row) is still there.
 *
 * A separate child that renders nothing, so `useLocation` re-renders only this component on every
 * navigation instead of the whole dashboard layout. The ref guard skips the first mount and
 * StrictMode's second effect run, neither of which is a navigation.
 */
export function CloseViewerOnRouteChange(): null {
  const { pathname } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current !== pathname) {
      previous.current = pathname;
      useDocumentViewer.getState().close();
    }
  }, [pathname]);

  return null;
}
