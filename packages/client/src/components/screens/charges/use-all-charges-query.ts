import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from 'urql';
import { AllChargesDocument, type AllChargesQuery } from '../../../gql/graphql.js';
import {
  subscribeAllChargesPrefetch,
  type AllChargesVariables,
} from '../../../router/loaders/all-charges-loader.js';

export type AllChargesQueryState = {
  data: AllChargesQuery | undefined;
  loading: boolean;
  /** Fetches the current variables again from the network. */
  refetch: () => void;
};

/**
 * The All Charges list for `variables`, fetched whenever they change while `enabled`.
 *
 * The route loader usually started the first request before the screen mounted (see
 * `allChargesLoader`); while the screen has not fetched anything itself, it takes that request over
 * instead of sending its own. `variables` must be a stable reference: a new object means new
 * variables.
 */
export function useAllChargesQuery(
  variables: AllChargesVariables,
  enabled: boolean,
): AllChargesQueryState {
  const [{ data: fetchedData, fetching }, fetchCharges] = useQuery({
    query: AllChargesDocument,
    variables,
    pause: true,
  });

  // The loader's result, with the variables it was for.
  const [prefetched, setPrefetched] = useState<{
    variables: AllChargesVariables;
    data: AllChargesQuery;
  }>();
  const [awaitingPrefetch, setAwaitingPrefetch] = useState(false);

  // Set once the screen fetches anything itself. From then on its own results are the newest, so
  // it never takes a prefetch over again: one it left before the response finished stays in the
  // loader until the next visit, and coming back to those variables would show that old result.
  const hasFetched = useRef(false);
  const refetch = useCallback(() => {
    hasFetched.current = true;
    fetchCharges({ requestPolicy: 'network-only' });
  }, [fetchCharges]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const unsubscribe = hasFetched.current
      ? undefined
      : subscribeAllChargesPrefetch(variables, outcome => {
          setAwaitingPrefetch(false);
          if (outcome.kind === 'data') {
            // Arrives again as each deferred part of the response lands.
            setPrefetched({ variables, data: outcome.data });
          } else if (outcome.kind === 'skipped') {
            refetch();
          }
        });
    if (!unsubscribe) {
      refetch();
      return;
    }
    setAwaitingPrefetch(true);
    return () => {
      unsubscribe();
      setAwaitingPrefetch(false);
    };
  }, [enabled, variables, refetch]);

  // urql's result wins once the screen has fetched anything itself. Until then the prefetched
  // result shows, and it keeps showing (as stale rows under the overlay) while the first
  // refetch for other variables is in flight, as urql's own results do.
  const data =
    fetchedData ??
    (prefetched && (fetching || prefetched.variables === variables) ? prefetched.data : undefined);

  return { data, loading: fetching || awaitingPrefetch, refetch };
}
