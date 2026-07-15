import { useState } from 'react';
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
  const [stable, setStable] = useState<T>(value);

  // Fast path: an identical reference (e.g. an unrelated local state update such
  // as sorting or expanding a row) skips the potentially expensive deep
  // comparison. Only when the reference changed — e.g. a urql refetch returned a
  // fresh object — do we fall back to deep equality, and adopt the new reference
  // solely when the content genuinely differs. Updating state during render is
  // React's supported pattern for deriving state from arguments.
  if (stable !== value && !equal(stable, value)) {
    setStable(value);
    return value;
  }

  return stable;
}
