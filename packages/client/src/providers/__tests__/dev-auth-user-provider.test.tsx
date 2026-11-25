import { act, useContext, useEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Client, Provider, fetchExchange } from 'urql';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserContext, UserProvider } from '../user-provider.js';

/**
 * The dev-auth provider (`VITE_DEV_AUTH=1`), which reads the user context with a query of its
 * own. A new business scope hands it a new urql client, as it does the Auth0 provider (see
 * `boot-request.test.tsx`), and the app must come back on the new scope's context.
 */

// The provider module reads the flag when it is evaluated, so it is set before the imports run.
vi.hoisted(() => {
  vi.stubEnv('VITE_DEV_AUTH', '1');
});
vi.mock('@auth0/auth0-react', () => ({ useAuth0: () => ({}) }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const OTHER_SCOPE_USER_CONTEXT = {
  ...USER_CONTEXT,
  memberships: [{ businessId: 'business-2', role: 'business_owner', businessName: 'Globex' }],
  activeReadScope: ['business-2'],
  defaultLocalCurrency: 'USD',
};

let operations: string[];
let contextsSeen: string[];
let screenMounts: number;
let root: Root | null;
let container: HTMLDivElement;
let releaseAnswers: (() => void) | null;
let answersHeld: Promise<void> | null;

function Screen(): ReactElement {
  const { userContext } = useContext(UserContext);
  const seen = userContext
    ? `${userContext.context.adminBusinessId}/${userContext.context.defaultLocalCurrency}`
    : 'none';
  contextsSeen.push(seen);
  useEffect(() => {
    screenMounts += 1;
  }, []);
  return <output data-slot="context">{seen}</output>;
}

/** An urql client that records each operation and answers with this user context. */
function makeClient(userContext: typeof USER_CONTEXT): Client {
  const mockFetch = (async (_url: string, init: RequestInit) => {
    operations.push((JSON.parse(String(init.body)) as { operationName: string }).operationName);
    if (answersHeld) {
      await answersHeld;
    }
    const body = JSON.stringify({
      data: {
        viewer: { email: 'dev@example.com', emailVerified: true, status: 'ACTIVE' },
        userContext,
      },
    });
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

async function render(client: Client) {
  await act(async () => {
    root ??= createRoot(container);
    root.render(
      <Provider value={client}>
        <UserProvider>
          <Screen />
        </UserProvider>
      </Provider>,
    );
  });
}

async function settle() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
}

const shownContext = () => container.querySelector('[data-slot="context"]')?.textContent;

beforeEach(() => {
  operations = [];
  contextsSeen = [];
  screenMounts = 0;
  root = null;
  answersHeld = null;
  releaseAnswers = null;
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container.remove();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('the dev-auth user provider', () => {
  it('reads the user context again for a new business scope, and comes back on the new one', async () => {
    await render(makeClient(USER_CONTEXT));
    await settle();
    expect(shownContext()).toBe('business-1/ILS');
    expect(operations).toEqual(['UserContext']);
    expect(new Set(contextsSeen)).toEqual(new Set(['business-1/ILS']));

    // What applying a business scope does (`setBusinessScope`): a new urql client.
    contextsSeen = [];
    answersHeld = new Promise<void>(resolve => {
      releaseAnswers = resolve;
    });
    await render(makeClient(OTHER_SCOPE_USER_CONTEXT));
    // The loader takes the app's place until the new scope's context is in.
    expect(shownContext()).toBeUndefined();
    answersHeld = null;
    releaseAnswers?.();
    await settle();

    expect(operations).toEqual(['UserContext', 'UserContext']);
    expect(shownContext()).toBe('business-2/USD');
    // From the swap on, every render of the screen is on the new scope's context. On the
    // previous one it would ask the new scope about the old business, and on none it would seed
    // its filters empty.
    expect(new Set(contextsSeen)).toEqual(new Set(['business-2/USD']));
    expect(screenMounts).toBe(2);
  });
});
