import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, type Location, type Path } from 'react-router-dom';

/** The `history.state` flag that marks the entry the full-screen overlay pushed. */
export type DocViewerState = { docViewer: true };

export function isDocViewerState(state: unknown): state is DocViewerState {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as { docViewer?: unknown }).docViewer === true
  );
}

function stateObject(state: unknown): Record<string, unknown> {
  return typeof state === 'object' && state !== null ? (state as Record<string, unknown>) : {};
}

/**
 * The URL to push or replace: the address bar's, not the router's copy. `useUrlQuery.set` writes
 * `history.pushState` directly, so the router's `location` can lag behind a just-set query
 * parameter, and pushing it would drop that parameter from the address bar. The address bar is
 * used only while it shows the router's page (it always does in the app; a memory router in tests
 * leaves it elsewhere).
 */
function currentPath(location: Location): Partial<Path> {
  const { pathname, search, hash } = window.location;
  if (pathname === location.pathname) {
    return { pathname, search, hash };
  }
  return { pathname: location.pathname, search: location.search, hash: location.hash };
}

/**
 * Where the overlay's history entry is:
 * - `idle`: none pushed.
 * - `pushing`: pushed, but the location doesn't carry the flag yet. A data router navigates
 *   asynchronously, and StrictMode re-runs the mount effect before the location updates. If another
 *   navigation lands first (an unflagged location with a new key), the push was superseded and the
 *   phase goes back to `idle`.
 * - `pushed`: the current entry is the overlay's.
 * - `leaving`: `navigate(-1)` is on its way; the Back path finishes the close.
 */
type Phase = 'idle' | 'pushing' | 'pushed' | 'leaving';

export interface UseOverlayHistoryOptions {
  /** The full-screen overlay is showing a document. Only then is there a history entry. */
  active: boolean;
  /** Closes the viewer in the store. */
  close: () => void;
  /**
   * The id of the document the overlay is showing. A ✕ goes back first and closes when Back lands;
   * if another document was opened (or stepped to) in between, that one stays open. An id, not the
   * entry: the store swaps in a fresh entry object for the same document after an edit is saved.
   */
  entryId?: string | null;
}

/**
 * Lets Back close the full-screen overlay, as a phone user expects (decision 13). Opening pushes
 * the current location again with `state.docViewer` set; the flag turning falsy (Back) closes the
 * viewer. The pathname never changes, so the route-change close doesn't fire.
 *
 * Returns `requestClose` for ✕ and Esc. With the entry in place it only goes back, and the Back
 * path closes: calling `close()` first would trip the leftover rule below, which would replace the
 * entry before the back navigation lands.
 *
 * A flag with nothing open (a reload restores `history.state`, or Back into an entry a pathname
 * change left behind) is cleared with a `replace`, on every location change.
 *
 * The sheet above a modal and the docked column never touch history: `active` is false for them.
 */
export function useOverlayHistory({
  active,
  close,
  entryId = null,
}: UseOverlayHistoryOptions): () => void {
  const location = useLocation();
  const navigate = useNavigate();
  const phaseRef = useRef<Phase>('idle');
  /** The location key the push was made from, to tell a superseded push from a pending one. */
  const pushedFromKeyRef = useRef<string | null>(null);
  /** The document a ✕ asked to close, while its back navigation is on the way. */
  const closingEntryIdRef = useRef<string | null>(null);
  const entryIdRef = useRef(entryId);
  // A layout effect, so it is current before the effect below and before any click handler.
  useLayoutEffect(() => {
    entryIdRef.current = entryId;
  });
  /** The location key a leftover flag was last cleared on, so StrictMode doesn't replace twice. */
  const clearedKeyRef = useRef<string | null>(null);
  const flagged = isDocViewerState(location.state);

  useEffect(() => {
    if (flagged && phaseRef.current === 'pushing') {
      phaseRef.current = 'pushed';
    }

    if (!flagged && phaseRef.current === 'pushing' && location.key !== pushedFromKeyRef.current) {
      // Another navigation won the race and the push never landed. Start over, so the overlay
      // pushes its entry again (below) and Back doesn't leave the page.
      phaseRef.current = 'idle';
    }

    const phase = phaseRef.current;
    if (!flagged && (phase === 'pushed' || phase === 'leaving')) {
      // Back (or ✕ through Back) left the overlay's entry.
      phaseRef.current = 'idle';
      const reopened = phase === 'leaving' && closingEntryIdRef.current !== entryIdRef.current;
      closingEntryIdRef.current = null;
      if (!reopened) {
        close();
        return;
      }
      // ✕ was for another document: the one opened since stays, and gets its own entry below.
    }

    if (active && !flagged && phaseRef.current === 'idle') {
      // The ref is set first: StrictMode's second run happens before the location updates.
      phaseRef.current = 'pushing';
      pushedFromKeyRef.current = location.key;
      // `preventScrollReset`: the page under the overlay keeps its scroll position.
      navigate(currentPath(location), {
        state: { ...stateObject(location.state), docViewer: true },
        preventScrollReset: true,
      });
      return;
    }

    if (!active && flagged) {
      if (phaseRef.current === 'pushed') {
        // Closed some other way while its entry is current: step off it, so no stale entry stays.
        phaseRef.current = 'leaving';
        navigate(-1);
      } else if (phaseRef.current === 'idle' && clearedKeyRef.current !== location.key) {
        clearedKeyRef.current = location.key;
        navigate(currentPath(location), {
          replace: true,
          state: { ...stateObject(location.state), docViewer: undefined },
          preventScrollReset: true,
        });
      }
    }
  }, [active, close, flagged, location, navigate]);

  return useCallback((): void => {
    if (phaseRef.current === 'leaving') {
      return;
    }
    if (phaseRef.current === 'pushed') {
      phaseRef.current = 'leaving';
      closingEntryIdRef.current = entryIdRef.current;
      navigate(-1);
      return;
    }
    close();
  }, [close, navigate]);
}
