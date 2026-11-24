import { act, useContext, useEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Client, Provider, fetchExchange } from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomePage } from '../../components/screens/welcome.js';
import { useSessionViewer } from '../../hooks/use-viewer.js';
import { ProtectedRoute } from '../../router/guards/auth-guards.js';
import { ROUTES } from '../../router/routes.js';
import { UserContext, UserProvider } from '../user-provider.js';

/**
 * Opening the app sends one boot request: the user context and the onboarding guard's `viewer`
 * travel together, and for a provisioned user the guard sends nothing of its own. A not-active
 * answer is the one the guard reads again before acting on it, since it can be stale by then.
 *
 * The answer is also read again whenever it can have changed: for a new business scope or
 * identity behind the loader, and in the background once the guard learns it is out of date.
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

/** What the server says about the same user under another business scope. */
const OTHER_SCOPE_USER_CONTEXT = {
  ...USER_CONTEXT,
  memberships: [{ businessId: 'business-2', role: 'business_owner', businessName: 'Globex' }],
  activeReadScope: ['business-2'],
  defaultLocalCurrency: 'USD',
};

type Payload = { data: unknown; errors?: unknown[] };

/** What the server answers: the same for every operation, or chosen per operation name. */
type Answer = Payload | 'network-error' | ((operationName: string) => Payload | 'network-error');

const ACTIVE_VIEWER = { email: 'member@example.com', emailVerified: true, status: 'ACTIVE' };
const NEW_VIEWER = { email: 'new@example.com', emailVerified: true, status: 'NO_WORKSPACE' };

/** The boot answer for a provisioned user. */
function activeBoot(userContext: typeof USER_CONTEXT = USER_CONTEXT, viewer = ACTIVE_VIEWER): Payload {
  return { data: { viewer, userContext } };
}

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

/** While set, the server keeps its answers back; `releaseAnswers` lets them go. */
let answersHeld: Promise<void> | null;
let releaseAnswers: () => void;

/** Makes the server sit on its answers, to look at the app while a request is in flight. */
function holdAnswers(): void {
  answersHeld = new Promise<void>(resolve => {
    releaseAnswers = () => {
      answersHeld = null;
      resolve();
    };
  });
}

/** The user context the screen rendered with, one entry per render: `business-1/ILS`, or `none`. */
let contextsSeen: string[];
let screenMounts: number;

/** Stands in for a screen of the app: shows what the provider gives it, and keeps a record. */
function Screen(): ReactElement {
  const { userContext, refreshUserContext } = useContext(UserContext);
  const { viewer } = useSessionViewer();
  const seen = userContext
    ? `${userContext.context.adminBusinessId}/${userContext.context.defaultLocalCurrency}`
    : 'none';
  contextsSeen.push(seen);
  useEffect(() => {
    screenMounts += 1;
  }, []);
  return (
    <div>
      Charges Page
      <output data-slot="context">{seen}</output>
      <output data-slot="status">{viewer?.status ?? 'unknown'}</output>
      <button type="button" data-slot="refresh" onClick={() => void refreshUserContext?.()}>
        Refresh
      </button>
    </div>
  );
}

/** The text the screen shows in one of its slots, or undefined while the screen is not mounted. */
function shown(slot: 'context' | 'status'): string | undefined {
  return container.querySelector(`[data-slot="${slot}"]`)?.textContent ?? undefined;
}

/** An urql client whose fetch records each operation and answers with `answer`, or fails. */
function makeClient(answer: Answer): Client {
  const mockFetch = (async (_url: string, init: RequestInit) => {
    const { operationName } = JSON.parse(String(init.body)) as { operationName: string };
    operations.push(operationName);
    if (answersHeld) {
      await answersHeld;
    }
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
            <Screen />
          </ProtectedRoute>
        ),
      },
    ],
    { initialEntries: [startAt] },
  );
  let client = makeClient(answer);
  const render = async () => {
    await act(async () => {
      root ??= createRoot(container);
      root.render(
        <Provider value={client}>
          <UserProvider>
            <RouterProvider router={router} />
          </UserProvider>
        </Provider>,
      );
    });
  };
  await render();
  await settle();
  return {
    router,
    /** Renders again with the same urql client, as when something above the app changes. */
    rerender: render,
    /**
     * What applying a business scope does (`setBusinessScope`): the app is handed a new urql
     * client, and from then on the server answers for the new scope.
     */
    swapClient: async (nextAnswer: Answer) => {
      client = makeClient(nextAnswer);
      await render();
    },
  };
}

beforeEach(() => {
  operations = [];
  answersHeld = null;
  contextsSeen = [];
  screenMounts = 0;
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
    await openApp(activeBoot());

    expect(container.textContent).toContain('Charges Page');
    expect(shown('context')).toBe('business-1/ILS');
    expect(operations).toEqual(['UserContext']);
    // From its first render: screens seed their filters from the user context as they mount.
    expect(new Set(contextsSeen)).toEqual(new Set(['business-1/ILS']));
  });

  it('sends a user with no workspace to /welcome, once a fresh read agrees', async () => {
    const { router } = await openApp(operation =>
      operation === 'UserContext' ? NO_WORKSPACE_BOOT : { data: { viewer: NEW_VIEWER } },
    );

    expect(router.state.location.pathname).toBe(ROUTES.WELCOME);
    expect(container.textContent).not.toContain('Charges Page');
    // The boot request, then the guard's own read of the not-active answer.
    expect(operations).toEqual(['UserContext', 'Viewer']);
  });

  it('opens the app when the fresh read fails on the network, rather than trapping the user', async () => {
    const { router } = await openApp(operation =>
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

describe('a boot answer that went out of date', () => {
  const NEWLY_ACTIVE_VIEWER = { ...NEW_VIEWER, status: 'ACTIVE' };

  it('lets a user in after they accept an invitation, with their user context, without a reload', async () => {
    // The boot request answered before the invitation was accepted.
    let accepted = false;
    const { router } = await openApp(
      operation => {
        if (operation === 'UserContext') {
          return accepted ? activeBoot(USER_CONTEXT, NEWLY_ACTIVE_VIEWER) : NO_WORKSPACE_BOOT;
        }
        return { data: { viewer: accepted ? NEWLY_ACTIVE_VIEWER : NEW_VIEWER } };
      },
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
    // One fresh read lets them in: acting on the boot answer sent the user to /welcome, whose own
    // read sent them back, and so on. Then the boot request again, for the user context: the one
    // that came with "no workspace" is empty, and the app would stay without it until a reload.
    expect(operations).toEqual(['UserContext', 'Viewer', 'UserContext']);
    expect(shown('context')).toBe('business-1/ILS');
    expect(shown('status')).toBe('ACTIVE');
    // In place: the app the user was let into is the one that gets the context.
    expect(screenMounts).toBe(1);
  });

  it('lets a user in when /welcome finds them active, provisioned since the boot request', async () => {
    // An admin adds the membership after the guard's read, before /welcome's own.
    let viewerReads = 0;
    const { router } = await openApp(
      operation => {
        const provisioned = viewerReads > 0;
        if (operation === 'UserContext') {
          return provisioned ? activeBoot(USER_CONTEXT, NEWLY_ACTIVE_VIEWER) : NO_WORKSPACE_BOOT;
        }
        viewerReads += 1;
        return { data: { viewer: viewerReads > 1 ? NEWLY_ACTIVE_VIEWER : NEW_VIEWER } };
      },
      { welcome: <WelcomePage /> },
    );
    await settle();

    expect(router.state.location.pathname).toBe(ROUTES.APP_HOME);
    expect(container.textContent).toContain('Charges Page');
    // The boot request, the guard's read, /welcome's read, the guard's read on the way back in,
    // and the boot request again for the user context.
    expect(operations).toEqual(['UserContext', 'Viewer', 'Viewer', 'Viewer', 'UserContext']);
    expect(shown('context')).toBe('business-1/ILS');
  });

  it('reads the user context again, behind the loader, when the business scope changes', async () => {
    const app = await openApp(activeBoot());
    expect(shown('context')).toBe('business-1/ILS');

    contextsSeen = [];
    holdAnswers();
    await app.swapClient(activeBoot(OTHER_SCOPE_USER_CONTEXT));
    // The user context is per scope: the app gives way to the loader until the new one is in.
    expect(container.textContent).not.toContain('Charges Page');
    releaseAnswers();
    await settle();

    expect(operations).toEqual(['UserContext', 'UserContext']);
    expect(shown('context')).toBe('business-2/USD');
    // From the swap on, every render of the screen is on the new scope's context. On the
    // previous one it would ask the new scope about the old business, and on none it would seed
    // its filters empty.
    expect(new Set(contextsSeen)).toEqual(new Set(['business-2/USD']));
    expect(screenMounts).toBe(2);
  });

  it('reads it again, behind the loader, for another identity signed in without a reload', async () => {
    let identity = 'member@example.com';
    const app = await openApp(() =>
      activeBoot(identity === 'member@example.com' ? USER_CONTEXT : OTHER_SCOPE_USER_CONTEXT),
    );
    expect(shown('context')).toBe('business-1/ILS');

    // Re-authentication in place can sign in as someone else.
    identity = 'other@example.com';
    useAuth0Mock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { email: identity },
    });
    holdAnswers();
    await app.rerender();
    expect(container.textContent).not.toContain('Charges Page');
    contextsSeen = [];
    releaseAnswers();
    await settle();

    expect(operations).toEqual(['UserContext', 'UserContext']);
    expect(shown('context')).toBe('business-2/USD');
    // The app comes back on the new identity's context, from its first render.
    expect(new Set(contextsSeen)).toEqual(new Set(['business-2/USD']));
  });

  it('re-reads in place when a screen asks for it, keeping the app mounted', async () => {
    let currency = 'ILS';
    await openApp(() => activeBoot({ ...USER_CONTEXT, defaultLocalCurrency: currency }));
    expect(shown('context')).toBe('business-1/ILS');

    // A setting the user context is derived from was saved (`refreshUserContext`).
    currency = 'EUR';
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-slot="refresh"]')?.click();
    });
    expect(container.textContent).toContain('Charges Page');
    await settle();

    expect(operations).toEqual(['UserContext', 'UserContext']);
    expect(shown('context')).toBe('business-1/EUR');
    expect(screenMounts).toBe(1);
  });

  it('keeps the user context it has when such a re-read fails', async () => {
    await openApp(() => (operations.length > 1 ? 'network-error' : activeBoot()));

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-slot="refresh"]')?.click();
    });
    await settle();

    expect(operations).toEqual(['UserContext', 'UserContext']);
    expect(container.textContent).toContain('Charges Page');
    expect(shown('context')).toBe('business-1/ILS');
    expect(screenMounts).toBe(1);
  });
});
