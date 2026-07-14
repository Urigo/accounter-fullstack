import { useRef } from 'react';
import equal from 'deep-equal';

/**
 * Returns a referentially-stable version of `value` that only changes identity
 * when the value changes by deep equality.
 *
 * Useful for values derived from GraphQL query results: urql returns a fresh
 * `data` object on every (re)fetch, even when the underlying content is
 * identical. Feeding that straight into `useReactTable`/`useMemo` dependencies
 * forces the consumer to re-render on every background refetch, causing a
 * visible "blink". Wrapping the derived value here keeps the reference stable
 * so downstream renders only happen when the data actually changed.
 */
export function useStableValue<T>(value: T): T {
  const ref = useRef<T>(value);
  if (!equal(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}
