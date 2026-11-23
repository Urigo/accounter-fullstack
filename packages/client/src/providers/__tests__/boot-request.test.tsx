import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Client, Provider, fetchExchange } from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from '../../router/guards/auth-guards.js';
import { ROUTES } from '../../router/routes.js';
import { UserProvider } from '../user-provider.js';

/**
 * Opening the app sends one boot request: the user context and the onboarding guard's `viewer`
 * travel together, and the guard sends nothing of its own.
 */

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { useAuth0Mock } = vi.hoisted(() => ({ useAuth0Mock: vi.fn() }));
vi.mock('@auth0/auth0-react', () => ({ useAuth0: useAuth0Mock }));

const USER_CONTEXT = {
  memberships: [{ businessId: 'business-1', role: 'business_owner', businessName: 'Acme' }],
  activeReadScope: ['business-1'],
  defaultLocalCurrency: 'ILS',
  defaultCryptoConversionFiatCurrency: 'USD',
  ledgerLock: null,
  financialAccountsBusinessesIds: [],
  foreignSecuritiesBusinessId: null,
  locality: 'ISRAEL',
};

type Payload = { data: unknown; errors?: unknown[] };

let operations: string[];
let root: Root | null;
let container: HTMLDivElement;

/** An urql client whose fetch records each operation and answers with `payload`, or fails. */
function makeClient(payload: Payload | 'network-error'): Client {
  const mockFetch = (async (_url: string, init: RequestInit) => {
    operations.push((JSON.parse(String(init.body)) as { operationName: string }).operationName);
    if (payload === 'network-error') {
      throw new TypeError('Failed to fetch');
    }
    const body = JSON.stringify(payload);
    return {
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: async () => body,
      json: async () => JSON.parse(body),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return new Client({
    url: 'http://localhost/graphql',
    exchanges: [fetchExchange],
    fetch: mockFetch,
    preferGetMethod: false,
  });
}

async function openApp(payload: Payload | 'network-error') {
  const router = createMemoryRouter(
    [
      { path: ROUTES.WELCOME, element: <div>Welcome Page</div> },
      {
        path: ROUTES.CHARGES.ROOT,
        element: (
          <ProtectedRoute>
            <div>Charges Page</div>
          </ProtectedRoute>
        ),
      },
    ],
    { initialEntries: [ROUTES.CHARGES.ROOT] },
  );
  await act(async () => {
    root = createRoot(container);
    root.render(
      <Provider value={makeClient(payload)}>
        <UserProvider>
          <RouterProvider router={router} />
        </UserProvider>
      </Provider>,
    );
  });
  // Let the boot request answer and the tree settle.
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
  return router;
}

beforeEach(() => {
  operations = [];
  root = null;
  container = document.createElement('div');
  document.body.append(container);
  useAuth0Mock.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    user: { email: 'member@example.com' },
  });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container.remove();
});

describe('the boot request', () => {
  it('opens the app for a provisioned user with one request', async () => {
    await openApp({
      data: {
        viewer: { email: 'member@example.com', emailVerified: true, status: 'ACTIVE' },
        userContext: USER_CONTEXT,
      },
    });

    expect(container.textContent).toContain('Charges Page');
    expect(operations).toEqual(['UserContext']);
  });

  it('sends a user with no workspace to /welcome, from the same one request', async () => {
    const router = await openApp({
      data: {
        viewer: { email: 'new@example.com', emailVerified: true, status: 'NO_WORKSPACE' },
        userContext: null,
      },
      errors: [
        {
          message: 'Onboarding required',
          path: ['userContext'],
          extensions: { code: 'ONBOARDING_REQUIRED' },
        },
      ],
    });

    expect(router.state.location.pathname).toBe(ROUTES.WELCOME);
    expect(operations).toEqual(['UserContext']);
  });

  it('opens the app when the boot request fails on the network, rather than trapping the user', async () => {
    await openApp('network-error');

    expect(container.textContent).toContain('Charges Page');
    expect(operations).toEqual(['UserContext']);
  });
});
