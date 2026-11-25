import type { LoaderFunctionArgs, ShouldRevalidateFunction } from 'react-router-dom';
import {
  chargeFilterUrlSchema,
  CHARGES_FILTER_PARAM,
} from '../../components/charges/charges-filters/schema.js';
import { AllChargesDocument, type AllChargesQuery, type ChargeFilter } from '../../gql/graphql.js';
import { parsePageParam } from '../../hooks/use-url-page.js';
import {
  canSendAuthenticatedRequests,
  getBusinessScopeIds,
  getUrqlClient,
} from '../../providers/urql.js';
import { areFiltersEqual, decodeFilters } from '../routes.js';

/**
 * All Charges route loader: starts the screen's first query while the app is still booting.
 *
 * Without it the query waits for the lazy screen to mount, and React holds a resolved Suspense
 * boundary back for up to ~300 ms after its fallback appears, so the request went out ~400 ms
 * into a cold load, with the network idle for most of that. The loader runs as soon as the router
 * matches the URL, so the request starts as soon as there is a token, alongside the app's own
 * boot queries.
 *
 * The loader doesn't wait for the result: navigation and the skeleton render as before, and the
 * screen follows the in-flight request with `subscribeAllChargesPrefetch` instead of sending its own.
 * There is no client-side cache to hand a result over through, so the hand-off is this module.
 */

/** Page size of the All Charges list. */
export const ALL_CHARGES_PAGE_SIZE = 100;

export type AllChargesVariables = {
  filters: Partial<ChargeFilter>;
  page: number;
  limit: number;
};

/** A state of the prefetched request, as the screen receives it. */
export type AllChargesPrefetchOutcome =
  /**
   * The result so far, for the screen to show. The list defers some fields (`@defer`), so this
   * arrives again, more complete, as each deferred part of the response lands.
   */
  | { kind: 'data'; data: AllChargesQuery }
  /** The request ran and failed; the error is already reported, so don't repeat it. */
  | { kind: 'failed' }
  /** No usable request was made (no session, or the business scope changed): fetch as usual. */
  | { kind: 'skipped' };

type Listener = (outcome: AllChargesPrefetchOutcome) => void;

type Prefetch = {
  variables: AllChargesVariables;
  latest: AllChargesPrefetchOutcome | null;
  /** Whether `latest` is final: the response is complete, failed or skipped. */
  done: boolean;
  listeners: Set<Listener>;
};

let prefetch: Prefetch | null = null;

/** Ends the last prefetch's request, if it is still subscribed. */
let endPreviousRequest: (() => void) | null = null;

/** The screen's chunk; shared with the route's `lazy()` so the two load it once. */
export function loadAllChargesScreen() {
  return import('../../components/screens/charges/all-charges.js');
}

/** The query variables the screen will use for this URL (see `useChargesFilter`, `useUrlPage`). */
export function allChargesVariablesFromUrl(url: URL): AllChargesVariables {
  return {
    filters: decodeFilters(url.searchParams.get(CHARGES_FILTER_PARAM), chargeFilterUrlSchema),
    page: parsePageParam(url.searchParams.get('page')),
    limit: ALL_CHARGES_PAGE_SIZE,
  };
}

function scopeKey(): string {
  return getBusinessScopeIds().join(',');
}

/** Once a settled prefetch has reached the screen it is used up, so a later visit refetches. */
function releaseIfDelivered(current: Prefetch): void {
  if (current.done && current.listeners.size > 0 && prefetch === current) {
    prefetch = null;
  }
}

function emit(current: Prefetch, outcome: AllChargesPrefetchOutcome, done: boolean): void {
  current.latest = outcome;
  current.done = done;
  for (const listener of current.listeners) {
    listener(outcome);
  }
  releaseIfDelivered(current);
}

function startPrefetch(variables: AllChargesVariables): Prefetch {
  const current: Prefetch = { variables, latest: null, done: false, listeners: new Set() };
  void (async () => {
    if (!(await canSendAuthenticatedRequests())) {
      emit(current, { kind: 'skipped' }, true);
      return;
    }
    // A newer visit replaced this one while it waited for a token.
    if (prefetch !== current) {
      return;
    }
    // The scope decides which businesses' charges come back. If the user switches it before the
    // response is complete, the result is for the wrong scope.
    const scope = scopeKey();
    let finished = false;
    // Subscribed rather than `toPromise()`, which resolves only once the whole deferred response
    // is in: streaming every part gets the first rows to the screen before the deferred fields
    // land. The subscription is what keeps the request alive, so it must not end with the
    // screen's interest in it.
    const subscription = getUrqlClient()
      .query(AllChargesDocument, variables, { requestPolicy: 'network-only' })
      .subscribe(result => {
        if (finished) {
          return;
        }
        if (scope === scopeKey()) {
          finished = !result.hasNext;
          emit(
            current,
            result.data ? { kind: 'data', data: result.data } : { kind: 'failed' },
            finished,
          );
        } else {
          finished = true;
          emit(current, { kind: 'skipped' }, true);
        }
      });
    // Not ended on the last part: urql may still be reading the response's closing bytes then,
    // and ending it aborts that read. A screen's own query stays subscribed while the screen is
    // mounted; this one stays until the next visit to the route.
    endPreviousRequest = () => subscription.unsubscribe();
  })();
  return current;
}

export function allChargesLoader({ request }: LoaderFunctionArgs): null {
  endPreviousRequest?.();
  endPreviousRequest = null;
  prefetch = null;
  void loadAllChargesScreen();

  const variables = allChargesVariablesFromUrl(new URL(request.url));
  // The screen fetches nothing until a filter is applied.
  if (Object.keys(variables.filters).length > 0) {
    prefetch = startPrefetch(variables);
  }
  return null;
}

/**
 * Prefetch only when the route is entered. Once the screen is mounted it fetches its own data on
 * every filter and page change, and those are URL changes that would otherwise re-run the loader.
 */
export const shouldRevalidateAllCharges: ShouldRevalidateFunction = () => false;

function sameVariables(a: AllChargesVariables, b: AllChargesVariables): boolean {
  return a.page === b.page && a.limit === b.limit && areFiltersEqual(a.filters, b.filters);
}

/**
 * Follows the prefetched request for these variables, if the loader started one: `listener`
 * receives its latest state, then every update, until the returned function is called. Returns
 * null when there is nothing to follow, and the screen should fetch for itself.
 *
 * The latest state is delivered on a microtask, never during this call. A request can be followed
 * more than once (React's StrictMode runs the screen's effect twice); once it has finished and
 * reached a listener it is used up, so a later visit with the same filter can't receive an old
 * result.
 */
export function subscribeAllChargesPrefetch(
  variables: AllChargesVariables,
  listener: Listener,
): (() => void) | null {
  const current = prefetch;
  if (!current || !sameVariables(current.variables, variables)) {
    return null;
  }
  // Wrapped so the catch-up below can tell whether an update already reached this listener.
  let received = false;
  const follower: Listener = outcome => {
    received = true;
    listener(outcome);
  };
  current.listeners.add(follower);
  queueMicrotask(() => {
    if (!received && current.listeners.has(follower) && current.latest) {
      follower(current.latest);
      releaseIfDelivered(current);
    }
  });
  return () => {
    current.listeners.delete(follower);
  };
}
