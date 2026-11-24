import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Client, Provider, fetchExchange } from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomePage } from '../../components/screens/welcome.js';
import { ProtectedRoute } from '../../router/guards/auth-guards.js';
import { ROUTES } from '../../router/routes.js';
import { UserProvider } from '../user-provider.js';

/**
 * Opening the app sends one boot request: the user context and the onboarding guard's `viewer`
 * travel together, and for a provisioned user the guard sends nothing of its own. A not-active
 * answer is the one the guard reads again before acting on it, since it can be stale by then.
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

/** What the server answers: the same for every operation, or chosen per operation name. */
type Answer = Payload | 'network-error' | ((operationName: string) => Payload | 'network-error');

const NEW_VIEWER = { email: 'new@example.com', emailVerified: true, status: 'NO_WORKSPACE' };

/** The boot answer for an identity linked to no business: `viewer` answers, `userContext` fails. */
const NO_WORKSPACE_BOOT: Payload = {
  data: { viewer: NEW_VIEWER, userContext: null },
  errors: [
    {
      message: 'Onboarding required',
      path: ['userContext'],
      extensions: { code: 'ONBOARDING_REQUIRED' },
    },
  ],
};

/**
 * More requests than any case here sends. Past it the server stops answering, so that a redirect
 * loop, which sends a request per round, ends in a failed assertion instead of never settling.
 */
const MAX_OPERATIONS = 10;

let operations: string[];
let root: Root | null;
let container: HTMLDivElement;

/** An urql client whose fetch records each operation and answers with `answer`, or fails. */
function makeClient(answer: Answer): Client {
  const mockFetch = (async (_url: string, init: RequestInit) => {
    const { operationName } = JSON.parse(String(init.body)) as { operationName: string };
    operations.push(operationName);
    const payload = typeof answer === 'function' ? answer(operationName) : answer;
    if (payload === 'network-error' || operations.length > MAX_OPERATIONS) {
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

/** Lets the requests in flight answer and the tree settle. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
}

async function openApp(
  answer: Answer,
  {
    startAt = ROUTES.CHARGES.ROOT,
    welcome = <div>Welcome Page</div>,
  }: { startAt?: string; welcome?: ReactElement } = {},
) {
  const router = createMemoryRouter(
    [
      { path: ROUTES.WELCOME, element: welcome },
      // Public, like /welcome: reachable while the identity is linked to no business.
      { path: ROUTES.ACCEPT_INVITATION(), element: <div>Accept Invitation Page</div> },
      {
        path: ROUTES.CHARGES.ROOT,
        element: (
          <ProtectedRoute>
            <div>Charges Page</div>
          </ProtectedRoute>
        ),
      },
    ],
    { initialEntries: [startAt] },
  );
  await act(async () => {
    root = createRoot(container);
    root.render(
      <Provider value={makeClient(answer)}>
        <UserProvider>
          <RouterProvider router={router} />
        </UserProvider>
      </Provider>,
    );
  });
  await settle();
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

  it('sends a user with no workspace to /welcome, once a fresh read agrees', async () => {
    const router = await openApp(operation =>
      operation === 'UserContext' ? NO_WORKSPACE_BOOT : { data: { viewer: NEW_VIEWER } },
    );

    expect(router.state.location.pathname).toBe(ROUTES.WELCOME);
    expect(container.textContent).not.toContain('Charges Page');
    // The boot request, then the guard's own read of the not-active answer.
    expect(operations).toEqual(['UserContext', 'Viewer']);
  });

  it('lets a user in after they accept an invitation, without a reload', async () => {
    // The boot request answers once per page load: here, before the invitation was accepted.
    let accepted = false;
    const router = await openApp(
      operation =>
        operation === 'UserContext'
          ? NO_WORKSPACE_BOOT
          : { data: { viewer: accepted ? { ...NEW_VIEWER, status: 'ACTIVE' } : NEW_VIEWER } },
      { startAt: ROUTES.ACCEPT_INVITATION('invite-token'), welcome: <WelcomePage /> },
    );
    expect(container.textContent).toContain('Accept Invitation Page');
    expect(operations).toEqual(['UserContext']);

    // What the accept page does once the server has linked the user to a business.
    accepted = true;
    await act(async () => {
      await router.navigate(ROUTES.APP_HOME, { replace: true });
    });
    await settle();

    expect(router.state.location.pathname).toBe(ROUTES.APP_HOME);
    expect(container.textContent).toContain('Charges Page');
    // One fresh read. Acting on the boot answer sent the user to /welcome, whose own read sent
    // them back, and so on: a request per round, and the app never rendered.
    expect(operations).toEqual(['UserContext', 'Viewer']);
  });

  it('lets a user in when /welcome finds them active, provisioned since the boot request', async () => {
    // An admin adds the membership after the guard's read, before /welcome's own.
    let viewerReads = 0;
    const router = await openApp(
      operation => {
        if (operation === 'UserContext') {
          return NO_WORKSPACE_BOOT;
        }
        viewerReads += 1;
        return { data: { viewer: viewerReads > 1 ? { ...NEW_VIEWER, status: 'ACTIVE' } : NEW_VIEWER } };
      },
      { welcome: <WelcomePage /> },
    );
    await settle();

    expect(router.state.location.pathname).toBe(ROUTES.APP_HOME);
    expect(container.textContent).toContain('Charges Page');
    // The boot request, the guard's read, /welcome's read, and the guard's read on the way back in.
    expect(operations).toEqual(['UserContext', 'Viewer', 'Viewer', 'Viewer']);
  });

  it('opens the app when the fresh read fails on the network, rather than trapping the user', async () => {
    const router = await openApp(operation =>
      operation === 'UserContext' ? NO_WORKSPACE_BOOT : 'network-error',
    );

    expect(router.state.location.pathname).toBe(ROUTES.CHARGES.ROOT);
    expect(container.textContent).toContain('Charges Page');
    expect(operations).toEqual(['UserContext', 'Viewer']);
  });

  it('opens the app when the boot request fails on the network, rather than trapping the user', async () => {
    await openApp('network-error');

    expect(container.textContent).toContain('Charges Page');
    expect(operations).toEqual(['UserContext']);
  });
});
