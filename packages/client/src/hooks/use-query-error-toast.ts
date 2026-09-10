import { useEffect } from 'react';
import { toast } from 'sonner';
import type { CombinedError } from 'urql';

/**
 * Reports a failed lookup query as a toast, once per error.
 *
 * The `use-get-*` hooks all used to do this inline in the hook body, which
 * fires on every render for as long as `error` is set — and React StrictMode
 * double-invokes on top of that. The repeated renders are only half of it:
 * with no toast id, sonner treats each of those calls as a new notification, so
 * they stack up instead of replacing one another.
 *
 * `subject` is the plural noun for what failed to load ("businesses", "tax
 * categories"). Both strings and the toast id derive from it, so callers cannot
 * drift into describing the same query two different ways.
 */
export function useQueryErrorToast(error: CombinedError | undefined, subject: string): void {
  useEffect(() => {
    if (!error) {
      return;
    }

    // The error goes as its own argument rather than interpolated: consoles
    // render a `CombinedError` with its `graphQLErrors` and stack intact, all of
    // which template interpolation would flatten into `[object Object]`-ish text.
    console.error(`Error fetching ${subject}:`, error);
    toast.error('Error', {
      id: `fetch-${subject}`,
      description: `Unable to fetch ${subject}`,
    });
  }, [error, subject]);
}
