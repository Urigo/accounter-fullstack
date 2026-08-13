import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CombinedError, Provider as UrqlProvider, type Client, type OperationResult } from 'urql';
import { fromValue, merge, never } from 'wonka';
import { Auth0Context, initialContext, type Auth0ContextInterface } from '@auth0/auth0-react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ROUTES } from '../../router/routes.js';
import { WelcomePage } from './welcome.js';

/**
 * `/welcome` is what an authenticated identity sees when it cannot use the app
 * yet. Which branch renders depends entirely on the `viewer` query, so each
 * story pins that answer with its own urql client rather than talking to a
 * server — the states below are otherwise awkward to reach on demand.
 */

type ViewerState = {
  email: string | null;
  emailVerified: boolean;
  status: 'ACTIVE' | 'EMAIL_UNVERIFIED' | 'NO_WORKSPACE';
  pendingInvitations: Array<{
    id: string;
    businessId: string;
    businessName: string | null;
    roleId: string;
    expiresAt: string;
  }>;
};

/**
 * A urql client that answers the `viewer` query with a fixed result. Nested
 * inside the global Provider from `.storybook/preview.tsx`, so it wins for the
 * component under test without needing `yarn mock:server` running.
 */
function makeViewerClient(
  viewer: ViewerState | null,
  options: { loading?: boolean; error?: CombinedError } = {},
): Client {
  // A failed request carries no data, so the error case must not also emit a
  // payload — otherwise the screen has an answer and never reaches its error branch.
  const result = (options.error
    ? { data: undefined, error: options.error, stale: false, hasNext: false }
    : { data: { viewer }, stale: false, hasNext: false }) as unknown as OperationResult;

  return {
    // `never` emits nothing, which keeps the hook in its fetching state.
    // Otherwise: emit the result and stay open, the way a real query source
    // does. A source that *completes* makes urql push a trailing
    // `{ fetching: false }`, and its state reducer keeps `data` across that but
    // resets `error` — which would make the failure story unreachable.
    executeQuery: () => (options.loading ? never : merge([fromValue(result), never])),
    executeMutation: () =>
      fromValue({
        data: { claimInvitation: { success: true, businessId: 'biz-1', roleId: 'employee' } },
        stale: false,
        hasNext: false,
      } as unknown as OperationResult),
    executeSubscription: () => never,
  } as unknown as Client;
}

const authenticated = {
  ...initialContext,
  isAuthenticated: true,
  isLoading: false,
  logout: async () => void 0,
} as unknown as Auth0ContextInterface;

const invitation = {
  id: 'inv-1',
  businessId: 'biz-1',
  businessName: 'Acme Ltd',
  roleId: 'employee',
  expiresAt: '2030-01-01T00:00:00.000Z',
};

function renderWelcome(
  viewer: ViewerState | null,
  options?: { loading?: boolean; error?: CombinedError },
) {
  return (
    <UrqlProvider value={makeViewerClient(viewer, options)}>
      <Auth0Context.Provider value={authenticated}>
        <MemoryRouter initialEntries={[ROUTES.WELCOME]}>
          <Routes>
            <Route path={ROUTES.WELCOME} element={<WelcomePage />} />
            {/* An ACTIVE viewer is redirected away, so give the target a home. */}
            <Route path={ROUTES.HOME} element={<div className="p-8">Redirected to the app</div>} />
            <Route path={ROUTES.LOGIN} element={<div className="p-8">Redirected to login</div>} />
          </Routes>
        </MemoryRouter>
      </Auth0Context.Provider>
    </UrqlProvider>
  );
}

const meta = {
  title: 'Screens/Welcome',
  component: WelcomePage,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof WelcomePage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The dead end: a verified account with no membership and nothing waiting for
 * it. Accounter is invitation-only, so this explains the situation instead of
 * dropping the user on an empty dashboard.
 */
export const NoWorkspace: Story = {
  render: () =>
    renderWelcome({
      email: 'new.user@example.com',
      emailVerified: true,
      status: 'NO_WORKSPACE',
      pendingInvitations: [],
    }),
};

/**
 * The address is unproven, so it is never matched against invitations — a
 * pending invitation for this email stays hidden until the address is verified.
 */
export const EmailUnverified: Story = {
  render: () =>
    renderWelcome({
      email: 'new.user@example.com',
      emailVerified: false,
      status: 'EMAIL_UNVERIFIED',
      pendingInvitations: [],
    }),
};

/** One invitation waiting — the way out of the dead end above. */
export const InvitationWaiting: Story = {
  render: () =>
    renderWelcome({
      email: 'new.user@example.com',
      emailVerified: true,
      status: 'NO_WORKSPACE',
      pendingInvitations: [invitation],
    }),
};

/** An accountant invited by several clients picks which one to join first. */
export const MultipleInvitations: Story = {
  render: () =>
    renderWelcome({
      email: 'accountant@example.com',
      emailVerified: true,
      status: 'NO_WORKSPACE',
      pendingInvitations: [
        invitation,
        {
          ...invitation,
          id: 'inv-2',
          businessId: 'biz-2',
          businessName: 'Globex Inc',
          roleId: 'accountant',
        },
        {
          ...invitation,
          id: 'inv-3',
          businessId: 'biz-3',
          businessName: null,
          roleId: 'accountant',
        },
      ],
    }),
};

/** While the viewer query is in flight, nothing is asserted about the account. */
export const Loading: Story = {
  render: () => renderWelcome(null, { loading: true }),
};

/**
 * The provisioning state is unknown, so the screen says so rather than claiming
 * the user has no workspace — a network blip is not an entitlement.
 */
export const QueryFailed: Story = {
  render: () =>
    renderWelcome(null, {
      error: new CombinedError({ networkError: new Error('Failed to fetch') }),
    }),
};
