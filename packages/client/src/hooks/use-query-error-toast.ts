import { useEffect } from 'react';
import { toast } from 'sonner';
import type { CombinedError } from 'urql';

/**
 * Reports a failed lookup query as a toast, once per error.
 *
 * The `use-get-*` hooks all used to do this inline in the hook body, which
 * fires on every render for as long as `error` is set — and React StrictMode
 * double-invokes on top of that. Untoasted repeats are not the only cost:
 * without a toast id, sonner treats each call as a new notification and stacks
 * them.
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

    console.error(`Error fetching ${subject}: ${error}`);
    toast.error('Error', {
      id: `fetch-${subject}`,
      description: `Unable to fetch ${subject}`,
    });
  }, [error, subject]);
}
