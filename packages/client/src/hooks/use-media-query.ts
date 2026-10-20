import { useCallback, useSyncExternalStore } from 'react';

function hasMatchMedia(): boolean {
  return typeof matchMedia === 'function';
}

/**
 * Whether a CSS media query matches, kept current as it changes.
 *
 * Read during render (`useSyncExternalStore`), so the very first commit already has the right
 * value: a layout chosen by a query never flashes its other branch on mount. Without `matchMedia`
 * (some test environments), it is always `false`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      if (!hasMatchMedia()) {
        return () => {};
      }
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = (): boolean => hasMatchMedia() && matchMedia(query).matches;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
