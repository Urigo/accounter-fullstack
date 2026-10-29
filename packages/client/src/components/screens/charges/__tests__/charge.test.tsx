// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { Provider, type Client } from 'urql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeScriptedClient } from '../../../../__tests__/helpers/scripted-client.js';
import { Charge } from '../charge.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeClient(operations: string[]): Client {
  return makeScriptedClient({ operations, fallback: () => ({ charge: null }) });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
    await Promise.resolve();
  });
  container.remove();
});

describe('Charge screen', () => {
  it('fetches the charge exactly once on mount', async () => {
    // The screen used to pair an already-unpaused `useQuery` with a mount effect
    // that re-executed it under the identical condition. That never cost a
    // second request — urql dedupes the re-execution against the operation still
    // in flight — so this count was already 1 before the effect was removed. The
    // assertion is here to keep it that way, not to record a fix.
    const operations: string[] = [];
    const client = makeClient(operations);

    // A *data* router, not `MemoryRouter`: `useLoaderData` throws outside one,
    // and in the app these screens are only ever reached as route elements of
    // `createBrowserRouter`. The route deliberately declares no loader, which
    // is what leaves `useLoaderData` undefined and lets the query run.
    const router = createMemoryRouter(
      [{ path: '/charges/:chargeId', element: <Charge /> }],
      { initialEntries: ['/charges/charge-1'] },
    );

    await act(async () => {
      root.render(
        <Provider value={client}>
          <RouterProvider router={router} />
        </Provider>,
      );
      await Promise.resolve();
    });

    expect(operations.filter(name => name === 'ChargeScreen')).toHaveLength(1);
  });
});
