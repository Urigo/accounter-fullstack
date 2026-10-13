import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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
 * Where the overlay's history entry is:
 * - `idle`: none pushed.
 * - `pushing`: pushed, but the location doesn't carry the flag yet. A data router navigates
 *   asynchronously, and StrictMode re-runs the mount effect before the location updates.
 * - `pushed`: the current entry is the overlay's.
 * - `leaving`: `navigate(-1)` is on its way; the Back path finishes the close.
 */
type Phase = 'idle' | 'pushing' | 'pushed' | 'leaving';

export interface UseOverlayHistoryOptions {
  /** The full-screen overlay is showing a document. Only then is there a history entry. */
  active: boolean;
  /** Closes the viewer in the store. */
  close: () => void;
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
export function useOverlayHistory({ active, close }: UseOverlayHistoryOptions): () => void {
  const location = useLocation();
  const navigate = useNavigate();
  const phaseRef = useRef<Phase>('idle');
  /** The location key a leftover flag was last cleared on, so StrictMode doesn't replace twice. */
  const clearedKeyRef = useRef<string | null>(null);
  const flagged = isDocViewerState(location.state);

  useEffect(() => {
    const phase = phaseRef.current;

    if (flagged && phase === 'pushing') {
      phaseRef.current = 'pushed';
    }

    if (!flagged && (phase === 'pushed' || phase === 'leaving')) {
      // Back (or ✕ through Back) left the overlay's entry.
      phaseRef.current = 'idle';
      close();
      return;
    }

    if (active && !flagged && phase === 'idle') {
      // The ref is set first: StrictMode's second run happens before the location updates.
      phaseRef.current = 'pushing';
      navigate(location, { state: { ...stateObject(location.state), docViewer: true } });
      return;
    }

    if (!active && flagged) {
      if (phaseRef.current === 'pushed') {
        // Closed some other way while its entry is current: step off it, so no stale entry stays.
        phaseRef.current = 'leaving';
        navigate(-1);
      } else if (phaseRef.current === 'idle' && clearedKeyRef.current !== location.key) {
        clearedKeyRef.current = location.key;
        navigate(location, {
          replace: true,
          state: { ...stateObject(location.state), docViewer: undefined },
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
      navigate(-1);
      return;
    }
    close();
  }, [close, navigate]);
}
