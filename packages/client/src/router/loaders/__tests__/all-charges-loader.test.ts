import type { LoaderFunctionArgs } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargeSortByField, type AllChargesQuery } from '../../../gql/graphql.js';
import { encodeFilters } from '../../routes.js';
import {
  allChargesLoader,
  allChargesVariablesFromUrl,
  shouldRevalidateAllCharges,
  subscribeAllChargesPrefetch,
  type AllChargesPrefetchOutcome,
  type AllChargesVariables,
} from '../all-charges-loader.js';

type FakeResult = { data?: AllChargesQuery; error?: Error; hasNext?: boolean };
type Sink = (result: FakeResult) => void;

const { queryMock, unsubscribeMock, canSendMock, scopeMock } = vi.hoisted(() => ({
  queryMock:
    vi.fn<(...args: unknown[]) => { subscribe: (sink: Sink) => { unsubscribe: () => void } }>(),
  unsubscribeMock: vi.fn(),
  canSendMock: vi.fn<() => Promise<boolean>>(),
  scopeMock: vi.fn<() => string[]>(),
}));

vi.mock('../../../providers/urql.js', () => ({
  getUrqlClient: () => ({ query: queryMock }),
  canSendAuthenticatedRequests: canSendMock,
  getBusinessScopeIds: scopeMock,
}));

// The loader preloads the screen's chunk; the screen itself isn't under test.
vi.mock('../../../components/screens/charges/all-charges.js', () => ({}));

const OWNER_ID = '6a20aa69-57ff-446e-8d6a-1e96d095e988';

const FILTER = {
  byOwners: [OWNER_ID],
  fromAnyDate: '2023-11-01',
  sortBy: { field: ChargeSortByField.Date, asc: false },
};

const FIRST_PART = {
  allCharges: { nodes: [{ id: 'c1' }], pageInfo: { totalPages: 3 } },
} as unknown as AllChargesQuery;
const COMPLETE = {
  allCharges: { nodes: [{ id: 'c1', invalidLedger: null }], pageInfo: { totalPages: 3 } },
} as unknown as AllChargesQuery;

/** The sink of the latest query, to push response parts through. */
let sink: Sink | null = null;

function urlFor(filter: Record<string, unknown> | null, page?: number): string {
  const params = new URLSearchParams();
  const encoded = filter ? encodeFilters(filter) : '';
  if (encoded) params.set('chargesFilters', encoded);
  if (page) params.set('page', String(page));
  return `https://app.test/charges${params.size ? `?${params}` : ''}`;
}

function runLoader(url: string): null {
  return allChargesLoader({
    request: new Request(url),
    params: {},
  } as unknown as LoaderFunctionArgs);
}

function variables(page = 0): AllChargesVariables {
  return allChargesVariablesFromUrl(new URL(urlFor(FILTER, page)));
}

/** Follows the prefetch, collecting what it delivers. */
function follow(vars: AllChargesVariables) {
  const received: AllChargesPrefetchOutcome[] = [];
  const unsubscribe = subscribeAllChargesPrefetch(vars, outcome => received.push(outcome));
  return { received, unsubscribe };
}

/** Lets the loader's auth check settle and the query start. */
async function queryStarted(): Promise<void> {
  await vi.waitFor(() => expect(sink).not.toBeNull());
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
  // A visit without a filter ends whatever the previous test left subscribed.
  runLoader(urlFor(null));
  sink = null;
  unsubscribeMock.mockReset();
  queryMock.mockReset().mockImplementation(() => ({
    subscribe: next => {
      sink = next;
      return { unsubscribe: unsubscribeMock };
    },
  }));
  canSendMock.mockReset().mockResolvedValue(true);
  scopeMock.mockReset().mockReturnValue(['business-1']);
});

describe('allChargesVariablesFromUrl', () => {
  it('reads the filter and page the screen will use', () => {
    expect(allChargesVariablesFromUrl(new URL(urlFor(FILTER, 2)))).toEqual({
      filters: {
        byOwners: [OWNER_ID],
        fromAnyDate: '2023-11-01',
        sortBy: { field: ChargeSortByField.Date, asc: false },
      },
      page: 2,
      limit: 100,
    });
  });

  it('falls back to no filter and the first page for unreadable parameters', () => {
    expect(
      allChargesVariablesFromUrl(new URL('https://app.test/charges?chargesFilters=%7Bnope&page=-3')),
    ).toEqual({ filters: {}, page: 0, limit: 100 });
  });
});

describe('allChargesLoader', () => {
  it('returns at once rather than waiting for the response', () => {
    expect(runLoader(urlFor(FILTER))).toBeNull();
  });

  it('sends nothing when no filter is applied', async () => {
    runLoader(urlFor(null));
    await flush();
    expect(queryMock).not.toHaveBeenCalled();
    expect(subscribeAllChargesPrefetch({ filters: {}, page: 0, limit: 100 }, () => {})).toBeNull();
  });

  it('starts the query with the URL variables', async () => {
    runLoader(urlFor(FILTER, 1));
    await queryStarted();
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]![1]).toEqual(variables(1));
    expect(queryMock.mock.calls[0]![2]).toEqual({ requestPolicy: 'network-only' });
  });

  it('streams every part of a deferred response to the screen', async () => {
    runLoader(urlFor(FILTER));
    const { received } = follow(variables());
    await queryStarted();

    sink!({ data: FIRST_PART, hasNext: true });
    expect(received).toEqual([{ kind: 'data', data: FIRST_PART }]);
    expect(unsubscribeMock).not.toHaveBeenCalled();

    sink!({ data: COMPLETE, hasNext: false });
    expect(received).toEqual([
      { kind: 'data', data: FIRST_PART },
      { kind: 'data', data: COMPLETE },
    ]);
  });

  // Ending it on the last part could abort urql's read of the response's closing bytes.
  it('keeps a finished request subscribed until the next visit', async () => {
    runLoader(urlFor(FILTER));
    follow(variables());
    await queryStarted();
    sink!({ data: COMPLETE, hasNext: false });
    await flush();
    expect(unsubscribeMock).not.toHaveBeenCalled();

    runLoader(urlFor(FILTER, 1));
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('never starts a request for a visit replaced while it waited for a token', async () => {
    let grant!: (value: boolean) => void;
    canSendMock.mockReturnValueOnce(new Promise(resolve => (grant = resolve)));
    runLoader(urlFor(FILTER, 1));
    runLoader(urlFor(FILTER, 2));
    await queryStarted();
    grant(true);
    await flush();
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]![1]).toEqual(variables(2));
  });

  it('gives a late follower the latest state, on a microtask', async () => {
    runLoader(urlFor(FILTER));
    await queryStarted();
    sink!({ data: FIRST_PART, hasNext: true });

    const { received } = follow(variables());
    expect(received).toEqual([]);
    await flush();
    expect(received).toEqual([{ kind: 'data', data: FIRST_PART }]);
  });

  it('can be followed more than once while running, and is used up once finished and delivered', async () => {
    runLoader(urlFor(FILTER));
    const first = follow(variables());
    first.unsubscribe!();
    const second = follow(variables());
    await queryStarted();
    sink!({ data: COMPLETE, hasNext: false });

    expect(first.received).toEqual([]);
    expect(second.received).toEqual([{ kind: 'data', data: COMPLETE }]);
    expect(subscribeAllChargesPrefetch(variables(), () => {})).toBeNull();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('hands nothing over for other variables', () => {
    runLoader(urlFor(FILTER, 1));
    expect(subscribeAllChargesPrefetch(variables(2), () => {})).toBeNull();
  });

  it('replaces the previous prefetch on every run', () => {
    runLoader(urlFor(FILTER, 1));
    runLoader(urlFor(null));
    expect(subscribeAllChargesPrefetch(variables(1), () => {})).toBeNull();
  });

  it('skips the request without a session, so the screen fetches as usual', async () => {
    canSendMock.mockResolvedValue(false);
    runLoader(urlFor(FILTER));
    const { received } = follow(variables());
    await vi.waitFor(() => expect(received).toEqual([{ kind: 'skipped' }]));
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('discards a response for a business scope that has since changed', async () => {
    runLoader(urlFor(FILTER));
    const { received } = follow(variables());
    await queryStarted();
    scopeMock.mockReturnValue(['business-2']);
    sink!({ data: COMPLETE, hasNext: false });
    expect(received).toEqual([{ kind: 'skipped' }]);
  });

  it('reports a failed request as failed, so the screen does not repeat it', async () => {
    runLoader(urlFor(FILTER));
    const { received } = follow(variables());
    await queryStarted();
    sink!({ error: new Error('boom'), hasNext: false });
    expect(received).toEqual([{ kind: 'failed' }]);
  });
});

describe('shouldRevalidateAllCharges', () => {
  it('never re-runs the loader for a mounted screen', () => {
    expect(
      shouldRevalidateAllCharges({
        currentUrl: new URL(urlFor(FILTER, 1)),
        nextUrl: new URL(urlFor(FILTER, 2)),
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidateAllCharges>[0]),
    ).toBe(false);
  });
});
