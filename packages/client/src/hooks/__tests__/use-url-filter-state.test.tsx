import { act, type Dispatch, type SetStateAction } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
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

function mountAt(search: string): void {
  window.history.replaceState(null, '', `/page${search}`);
  act(() => root.render(<BrowserRouter><Harness /></BrowserRouter>));
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
  container.remove();
});

describe('useUrlFilterState', () => {
  it('reads the filter from the URL', () => {
    mountAt(searchFor({ name: 'acme' }));
    expect(filter).toEqual({ name: 'acme' });
  });

  it('reads a missing parameter as no filter', () => {
    mountAt('?other=1');
    expect(filter).toEqual({});
    expect(paramInUrl()).toBeNull();
  });

  it('reads an invalid parameter as no filter, and drops it in place', () => {
    const length = window.history.length;
    mountAt(searchFor({ active: 'yes' }, { other: '1' }));
    expect(filter).toEqual({});
    expect(paramInUrl()).toBeNull();
    expect(new URLSearchParams(window.location.search).get('other')).toBe('1');
    expect(window.history.length).toBe(length);
  });

  it('pushes a history entry per change, and removes the parameter when cleared', () => {
    mountAt('');
    const length = window.history.length;

    act(() => setFilter({ name: 'acme' }));
    expect(paramInUrl()).toBe(encodeFilters({ name: 'acme' }));
    expect(window.history.length).toBe(length + 1);

    act(() => setFilter({}));
    expect(paramInUrl()).toBeNull();
    expect(window.history.length).toBe(length + 2);
  });

  it('canonicalizes a URL holding the same filter in place, without a history entry', () => {
    const length = window.history.length;
    mountAt(searchFor({ name: 'acme', active: true, other: null }));
    expect(filter).toEqual({ active: true, name: 'acme' });
    expect(paramInUrl()).toBe(encodeFilters({ active: true, name: 'acme' }));
    expect(window.history.length).toBe(length);
  });

  // Back to the entry the page was loaded on: the router's location for it is unchanged, since it
  // never saw the hook's own writes, so this relies on the hook's popstate listener.
  it('follows back / forward without overwriting the history', async () => {
    mountAt(searchFor({ name: 'first' }));
    act(() => setFilter({ name: 'second' }));
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
    mountAt('');
    act(() => setFilter({ name: 'acme' }));
    const before = filter;
    await traverse(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(filter).toBe(before);
  });
});
