import { act, type Dispatch, type SetStateAction } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { encodeFilters } from '../../router/routes.js';
import { useUrlFilterState } from '../use-url-filter-state.js';
import { useUrlPage } from '../use-url-page.js';

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
let page: number;
let setPage: Dispatch<SetStateAction<number>>;

// As the charges screens use it: a new filter starts over from the first page.
const RESET_PARAMS = ['page'];

function Harness(): null {
  [filter, setFilter] = useUrlFilterState(PARAM, schema, { resetParams: RESET_PARAMS });
  [page, setPage] = useUrlPage();
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

async function goToPage(value: SetStateAction<number>): Promise<void> {
  await act(async () => setPage(value));
}

function pageInUrl(): string | null {
  return new URLSearchParams(window.location.search).get('page');
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
    window.history.pushState(null, '', '/page?view=compact');

    await update({ name: 'acme' });
    expect(paramInUrl()).toBe(encodeFilters({ name: 'acme' }));
    expect(new URLSearchParams(window.location.search).get('view')).toBe('compact');
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

  it('drops the reset params in the same history entry as a new filter', async () => {
    await mountAt(searchFor({ name: 'first' }, { page: '3' }));
    expect(page).toBe(3);
    const length = window.history.length;

    await update({ name: 'second' });
    expect(paramInUrl()).toBe(encodeFilters({ name: 'second' }));
    expect(pageInUrl()).toBeNull();
    expect(page).toBe(0);
    expect(window.history.length).toBe(length + 1);

    // Back restores the filter and the page it was on, together.
    await traverse(() => window.history.back());
    expect(filter).toEqual({ name: 'first' });
    expect(page).toBe(3);
    expect(pageInUrl()).toBe('3');
  });

  it('keeps the reset params when only canonicalizing the URL', async () => {
    await mountAt(searchFor({ name: 'acme', active: true, other: null }, { page: '2' }));
    expect(paramInUrl()).toBe(encodeFilters({ active: true, name: 'acme' }));
    expect(pageInUrl()).toBe('2');
    expect(page).toBe(2);
  });

  it('pages back and forward without touching the filter', async () => {
    await mountAt(searchFor({ name: 'acme' }));
    const before = filter;

    await goToPage(2);
    await goToPage(current => current + 1);
    expect(page).toBe(3);
    expect(pageInUrl()).toBe('3');

    await traverse(() => window.history.back());
    expect(page).toBe(2);
    expect(filter).toBe(before);
    expect(paramInUrl()).toBe(encodeFilters({ name: 'acme' }));
  });
});
