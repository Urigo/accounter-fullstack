import { act, type Dispatch, type SetStateAction } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parsePageParam, useUrlPage } from '../use-url-page.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let router: ReturnType<typeof createBrowserRouter> | undefined;
let page: number;
let setPage: Dispatch<SetStateAction<number>>;

function Harness(): null {
  [page, setPage] = useUrlPage();
  return null;
}

async function mountAt(search: string): Promise<void> {
  window.history.replaceState(null, '', `/page${search}`);
  router = createBrowserRouter([{ path: '/page', element: <Harness /> }]);
  await act(async () => root.render(<RouterProvider router={router!} />));
}

async function goTo(value: SetStateAction<number>): Promise<void> {
  await act(async () => setPage(value));
}

const search = (): URLSearchParams => new URLSearchParams(window.location.search);

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

describe('parsePageParam', () => {
  it('reads a non-negative integer, and anything else as the first page', () => {
    expect(parsePageParam('3')).toBe(3);
    expect(parsePageParam('0')).toBe(0);
    expect(parsePageParam(null)).toBe(0);
    expect(parsePageParam('')).toBe(0);
    expect(parsePageParam('-1')).toBe(0);
    expect(parsePageParam('1.5')).toBe(0);
    expect(parsePageParam('abc')).toBe(0);
  });
});

describe('useUrlPage', () => {
  it('reads the page from the URL', async () => {
    await mountAt('?page=4');
    expect(page).toBe(4);
  });

  it('pushes a router entry per change, omits the first page, and keeps other params', async () => {
    await mountAt('?other=1');
    const length = window.history.length;

    await goTo(2);
    expect(search().get('page')).toBe('2');
    expect(search().get('other')).toBe('1');
    expect(window.history.length).toBe(length + 1);
    expect(window.history.state).toMatchObject({ idx: expect.any(Number) });

    await goTo(0);
    expect(search().has('page')).toBe(false);
    expect(page).toBe(0);
    expect(window.history.length).toBe(length + 2);
  });

  it('applies functional updates to the current page, and skips no-op writes', async () => {
    await mountAt('?page=1');
    const length = window.history.length;

    await goTo(current => current + 1);
    expect(page).toBe(2);

    await goTo(2);
    expect(window.history.length).toBe(length + 1);
  });

  it('follows back / forward', async () => {
    await mountAt('');
    await goTo(1);
    await goTo(2);

    await act(async () => {
      const popped = new Promise(resolve => {
        window.addEventListener('popstate', resolve, { once: true });
      });
      window.history.back();
      await popped;
    });
    expect(page).toBe(1);
  });
});
