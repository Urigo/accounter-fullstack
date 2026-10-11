import { act, type Dispatch, type SetStateAction } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { encodeFilters } from '../../router/routes.js';
import { useUrlFilterState } from '../use-url-filter-state.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PARAM = 'testFilters';

const schema = z.object({
  name: z.string().optional(),
  active: z.boolean().optional(),
});
type Filter = z.infer<typeof schema>;

let container: HTMLDivElement;
let root: Root;
let router: ReturnType<typeof createBrowserRouter> | undefined;
let filter: Partial<Filter>;
let setFilter: Dispatch<SetStateAction<Partial<Filter>>>;

function Harness(): null {
  [filter, setFilter] = useUrlFilterState(PARAM, schema);
  return null;
}

/** The query string the hook itself writes for `filter` (plus any other params). */
function searchFor(filter: Record<string, unknown>, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  params.set(PARAM, encodeFilters(filter)!);
  return `?${params}`;
}

/** Mounts the hook under a data router, as the app does (`createBrowserRouter`). */
async function mountAt(search: string): Promise<void> {
  window.history.replaceState(null, '', `/page${search}`);
  router = createBrowserRouter([{ path: '/page', element: <Harness /> }]);
  await act(async () => root.render(<RouterProvider router={router!} />));
}

async function update(value: SetStateAction<Partial<Filter>>): Promise<void> {
  await act(async () => setFilter(value));
}

function paramInUrl(): string | null {
  return new URLSearchParams(window.location.search).get(PARAM);
}

/** Runs a history traversal and waits for the popstate it fires. */
async function traverse(go: () => void): Promise<void> {
  await act(async () => {
    const popped = new Promise(resolve => {
      window.addEventListener('popstate', resolve, { once: true });
    });
    go();
    await popped;
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  router?.dispose();
  router = undefined;
  container.remove();
});

describe('useUrlFilterState', () => {
  it('reads the filter from the URL', async () => {
    await mountAt(searchFor({ name: 'acme' }));
    expect(filter).toEqual({ name: 'acme' });
  });

  it('reads a missing parameter as no filter', async () => {
    await mountAt('?other=1');
    expect(filter).toEqual({});
    expect(paramInUrl()).toBeNull();
  });

  it('reads an invalid parameter as no filter, and drops it in place', async () => {
    const length = window.history.length;
    await mountAt(searchFor({ active: 'yes' }, { other: '1' }));
    expect(filter).toEqual({});
    expect(paramInUrl()).toBeNull();
    expect(new URLSearchParams(window.location.search).get('other')).toBe('1');
    expect(window.history.length).toBe(length);
  });

  it('pushes a router history entry per change, and removes the parameter when cleared', async () => {
    await mountAt('');
    const length = window.history.length;

    await update({ name: 'acme' });
    expect(paramInUrl()).toBe(encodeFilters({ name: 'acme' }));
    expect(window.history.length).toBe(length + 1);
    // Written through the router, so the entry carries its bookkeeping and it saw the change.
    expect(window.history.state).toMatchObject({ idx: expect.any(Number) });
    expect(router!.state.location.search).toBe(window.location.search);

    await update({});
    expect(paramInUrl()).toBeNull();
    expect(window.history.length).toBe(length + 2);
  });

  it('keeps parameters written outside the router', async () => {
    await mountAt('');
    // As `useUrlQuery` does: a bare pushState the router never sees.
    window.history.pushState(null, '', '/page?page=3');

    await update({ name: 'acme' });
    expect(paramInUrl()).toBe(encodeFilters({ name: 'acme' }));
    expect(new URLSearchParams(window.location.search).get('page')).toBe('3');
  });

  it('canonicalizes a URL holding the same filter in place, without a history entry', async () => {
    const length = window.history.length;
    await mountAt(searchFor({ name: 'acme', active: true, other: null }));
    expect(filter).toEqual({ active: true, name: 'acme' });
    expect(paramInUrl()).toBe(encodeFilters({ active: true, name: 'acme' }));
    expect(window.history.length).toBe(length);
  });

  it('follows back / forward without overwriting the history', async () => {
    await mountAt(searchFor({ name: 'first' }));
    await update({ name: 'second' });
    const length = window.history.length;

    await traverse(() => window.history.back());
    expect(filter).toEqual({ name: 'first' });
    expect(paramInUrl()).toBe(encodeFilters({ name: 'first' }));
    expect(window.history.length).toBe(length);

    // The forward entry survived the back navigation.
    await traverse(() => window.history.forward());
    expect(filter).toEqual({ name: 'second' });
    expect(window.history.length).toBe(length);
  });

  it('keeps the state object when the URL already matches', async () => {
    await mountAt('');
    await update({ name: 'acme' });
    const before = filter;
    await traverse(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(filter).toBe(before);
  });
});
