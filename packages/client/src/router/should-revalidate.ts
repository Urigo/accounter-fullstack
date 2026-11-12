import type { ShouldRevalidateFunction } from 'react-router-dom';

/**
 * Skips a loader re-run for a navigation that stays on the same URL (path, search and hash) and
 * submits nothing: a same-URL push, replace or Back.
 *
 * React Router revalidates every loader on such a navigation and holds the location until they
 * resolve. The document viewer's full-screen overlay navigates exactly like that (it adds
 * `state.docViewer` to the current entry and goes Back to close), so without this every open, ✕
 * and Back would refetch the screen query, appear to do nothing on a slow network, and on a failed
 * fetch swap the page (and an open edit sheet) for the route's error boundary.
 *
 * The cost: clicking a link to the page already shown no longer refetches it. Nothing calls
 * `useRevalidator`, and the loaders only prefetch for the screen's own `useQuery`.
 */
export const skipSameUrlRevalidation: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}) => {
  if (!formMethod && currentUrl.href === nextUrl.href) {
    return false;
  }
  return defaultShouldRevalidate;
};
