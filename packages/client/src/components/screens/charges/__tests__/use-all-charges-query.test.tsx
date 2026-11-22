import { act, StrictMode, useCallback, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { LoaderFunctionArgs } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargeSortByField, type AllChargesQuery } from '../../../../gql/graphql.js';
import {
  allChargesLoader,
  allChargesVariablesFromUrl,
  type AllChargesVariables,
} from '../../../../router/loaders/all-charges-loader.js';
import { encodeFilters } from '../../../../router/routes.js';
import { useAllChargesQuery, type AllChargesQueryState } from '../use-all-charges-query.js';

/**
 * The hand-off between the route loader's request and the All Charges screen: the screen takes
 * the loader's request over until it fetches anything itself, and never after.
 */

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type FakeResult = { data?: AllChargesQuery; hasNext?: boolean };
type Sink = (result: FakeResult) => void;

const { loaderQueryMock, canSendMock, screenFetches } = vi.hoisted(() => ({
  loaderQueryMock: vi.fn<(...args: unknown[]) => { subscribe: (sink: Sink) => unknown }>(),
  canSendMock: vi.fn<() => Promise<boolean>>(),
  /** Every fetch the screen sends itself, with a way to answer it. */
  screenFetches: [] as Array<{
    variables: AllChargesVariables;
    respond: (data: AllChargesQuery) => void;
  }>,
}));

vi.mock('../../../../providers/urql.js', () => ({
  getUrqlClient: () => ({ query: loaderQueryMock }),
  canSendAuthenticatedRequests: canSendMock,
  getBusinessScopeIds: () => ['business-1'],
}));

// The loader preloads the screen's chunk; the screen itself isn't under test.
vi.mock('../../../../components/screens/charges/all-charges.js', () => ({}));

// A paused `useQuery` as urql behaves: it fetches only when told to, and keeps its last `data`
// across variable changes until a new result arrives.
vi.mock('urql', async () => {
  const React = await import('react');
  return {
    useQuery: ({ variables }: { variables: AllChargesVariables }) => {
      const [state, setState] = React.useState<{
        data: AllChargesQuery | undefined;
        fetching: boolean;
      }>({ data: undefined, fetching: false });
      const execute = React.useCallback(() => {
        setState(previous => ({ ...previous, fetching: true }));
        screenFetches.push({ variables, respond: data => setState({ data, fetching: false }) });
      }, [variables]);
      return [state, execute];
    },
  };
});

const FILTER = {
  byOwners: ['6a20aa69-57ff-446e-8d6a-1e96d095e988'],
  sortBy: { field: ChargeSortByField.Date, asc: false },
};

function urlFor(page: number): string {
  const params = new URLSearchParams({ chargesFilters: encodeFilters(FILTER) ?? "" });
  if (page) params.set('page', String(page));
  return `https://app.test/charges?${params}`;
}

/** One stable variables object per page, as the screen's `useMemo` gives. */
const PAGES = [0, 1].map(page => allChargesVariablesFromUrl(new URL(urlFor(page))));

function pageData(label: string): AllChargesQuery {
  return {
    allCharges: { nodes: [{ id: label }], pageInfo: { totalPages: 2 } },
  } as unknown as AllChargesQuery;
}

let loaderSink: Sink | null = null;
let root: Root;
let container: HTMLDivElement;
let state: AllChargesQueryState;
let goToPage: (page: number) => void;

function Harness(): ReactElement {
  const [page, setPage] = useState(0);
  goToPage = useCallback((next: number) => setPage(next), []);
  state = useAllChargesQuery(PAGES[page]!, true);
  return <></>;
}

async function render(): Promise<void> {
  await act(async () => {
    root.render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
  });
}

/** Runs the route loader for page 0, as a visit to the screen does. */
async function visit(): Promise<void> {
  allChargesLoader({ request: new Request(urlFor(0)), params: {} } as unknown as LoaderFunctionArgs);
  await vi.waitFor(() => expect(loaderSink).not.toBeNull());
}

const shownIds = () => state.data?.allCharges.nodes.map(node => node.id);

/** The variables the screen fetched. StrictMode runs a mount effect twice, and urql merges the
 * identical requests that are in flight, so repeats are counted once. */
const fetchedVariables = () => [...new Set(screenFetches.map(fetch => fetch.variables))];

beforeEach(() => {
  // A visit without a filter ends whatever the previous test left subscribed.
  allChargesLoader({
    request: new Request('https://app.test/charges'),
    params: {},
  } as unknown as LoaderFunctionArgs);
  loaderSink = null;
  screenFetches.length = 0;
  loaderQueryMock.mockReset().mockImplementation(() => ({
    subscribe: (sink: Sink) => {
      loaderSink = sink;
      return { unsubscribe: () => {} };
    },
  }));
  canSendMock.mockReset().mockResolvedValue(true);
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe('useAllChargesQuery', () => {
  it("takes over the loader's request instead of sending its own", async () => {
    await visit();
    await render();

    expect(state.loading).toBe(true);
    await act(async () => loaderSink!({ data: pageData('prefetched-0'), hasNext: false }));

    expect(shownIds()).toEqual(['prefetched-0']);
    expect(state.loading).toBe(false);
    expect(screenFetches).toHaveLength(0);
  });

  it('fetches itself when there is no request to take over', async () => {
    await render();

    expect(fetchedVariables()).toEqual([PAGES[0]]);
  });

  it('fetches itself when the loader could not send its request', async () => {
    canSendMock.mockResolvedValue(false);
    allChargesLoader({
      request: new Request(urlFor(0)),
      params: {},
    } as unknown as LoaderFunctionArgs);
    await render();

    await vi.waitFor(() => expect(fetchedVariables()).toEqual([PAGES[0]]));
  });

  it('does not take over a request it left, once it has fetched by itself', async () => {
    await visit();
    await render();

    // The user moves to page 1 before the loader's page-0 response is in.
    await act(async () => goToPage(1));
    expect(screenFetches.map(fetch => fetch.variables)).toEqual([PAGES[1]]);
    await act(async () => screenFetches[0]!.respond(pageData('fetched-1')));
    // The loader's response finishes with nobody listening.
    await act(async () => loaderSink!({ data: pageData('prefetched-0'), hasNext: false }));

    // Back to page 0: a fresh fetch, not the old prefetched result, and not page 1's rows.
    await act(async () => goToPage(0));
    expect(screenFetches.map(fetch => fetch.variables)).toEqual([PAGES[1], PAGES[0]]);
    expect(state.loading).toBe(true);
    await act(async () => screenFetches[1]!.respond(pageData('fetched-0')));

    expect(shownIds()).toEqual(['fetched-0']);
  });

  it('keeps the taken-over rows on screen while the next page loads', async () => {
    await visit();
    await render();
    await act(async () => loaderSink!({ data: pageData('prefetched-0'), hasNext: false }));

    await act(async () => goToPage(1));

    expect(state.loading).toBe(true);
    expect(shownIds()).toEqual(['prefetched-0']);
    await act(async () => screenFetches[0]!.respond(pageData('fetched-1')));
    expect(shownIds()).toEqual(['fetched-1']);
  });
});
