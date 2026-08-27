// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserNav } from '../layout/user-nav.js';
import { UserContext, type UserInfo } from '../../providers/index.js';
import { ROUTES } from '../../router/routes.js';

const { useAuth0Mock, executeJobsMock, fetchDeelDocumentsMock, logoutMock, useMyMembershipsMock } =
  vi.hoisted(() => ({
    useAuth0Mock: vi.fn(),
    executeJobsMock: vi.fn(),
    fetchDeelDocumentsMock: vi.fn(),
    logoutMock: vi.fn(),
    useMyMembershipsMock: vi.fn(),
  }));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

vi.mock('../../hooks/use-cron-jobs.js', () => ({
  useCronJobs: () => ({ executeJobs: executeJobsMock }),
}));

vi.mock('../../hooks/use-fetch-deel-documents.js', () => ({
  useFetchDeelDocuments: () => ({ fetching: false, fetchDocuments: fetchDeelDocumentsMock }),
}));

vi.mock('../../hooks/use-my-memberships.js', () => ({
  useMyMemberships: useMyMembershipsMock,
}));

vi.mock('../common/modals/balance-charge-modal.js', () => ({
  BalanceChargeModal: () => null,
}));

// Stand-in that just lists the option labels, so tests can assert what the
// business-scope picker offers without driving a real popover.
vi.mock('../common/inputs/multi-select.js', () => ({
  MultiSelect: ({ options }: { options: Array<{ value: string; label: string }> }) => (
    <ul data-slot="business-scope-options">
      {options.map(option => (
        <li key={option.value}>{option.label}</li>
      ))}
    </ul>
  ),
}));

vi.mock('../ui/avatar.js', () => ({
  Avatar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) => (
    <img data-slot="avatar-image" src={src} alt={alt} />
  ),
  AvatarFallback: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../ui/dropdown-menu.js', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/index.js', () => {
  return {
    ConfirmationModal: ({ children }: { children?: React.ReactNode }) => children ?? null,
    SyncDocumentsModal: () => null,
    Tooltip: ({ children }: { children?: React.ReactNode }) => children ?? null,
    LogoutButton: () => (
      <button
        onClick={() =>
          logoutMock({
            logoutParams: {
              returnTo: `${window.location.origin}${ROUTES.LOGIN}`,
            },
          })
        }
      >
        Log out
      </button>
    ),
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const baseUserContext: UserInfo = {
  username: 'john@example.com',
  context: {
    adminBusinessId: '',
    defaultLocalCurrency: 'ILS',
    defaultCryptoConversionFiatCurrency: 'USD',
    ledgerLock: null,
    financialAccountsBusinessesIds: [],
    foreignSecuritiesBusinessId: null,
    locality: 'IL',
    memberships: [],
    activeReadScope: [],
  },
};

async function renderUserNav(userContext: UserInfo = baseUserContext) {
  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(
        UserContext.Provider,
        {
          value: {
            userContext,
            setUserContext: () => void 0,
          },
        },
        React.createElement(UserNav),
      ),
    );

    await Promise.resolve();
  });

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { container, cleanup };
}

describe('UserNav menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logoutMock.mockResolvedValue(undefined);
    // Default: the unscoped membership query has produced nothing yet.
    useMyMembershipsMock.mockReturnValue({ fetching: false, memberships: [] });
  });

  it('renders null when user is not authenticated', async () => {
    useAuth0Mock.mockReturnValue({
      isAuthenticated: false,
      user: null,
      logout: logoutMock,
    });

    const { container, cleanup } = await renderUserNav();

    expect(container.innerHTML).toBe('');
    await cleanup();
  });

  it('shows avatar image when user.picture is available', async () => {
    useAuth0Mock.mockReturnValue({
      isAuthenticated: true,
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        picture: 'https://example.com/john.png',
      },
      logout: logoutMock,
    });

    const { container, cleanup } = await renderUserNav();

    const image = container.querySelector('img[data-slot="avatar-image"]');
    expect(image).toBeTruthy();
    expect(image?.getAttribute('src')).toContain('https://example.com/john.png');

    await cleanup();
  });

  it('shows initials fallback when no picture is available', async () => {
    useAuth0Mock.mockReturnValue({
      isAuthenticated: true,
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      logout: logoutMock,
    });

    const { container, cleanup } = await renderUserNav();

    expect(container.textContent).toContain('JD');
    await cleanup();
  });

  it('shows name and email in dropdown content', async () => {
    useAuth0Mock.mockReturnValue({
      isAuthenticated: true,
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      logout: logoutMock,
    });

    const { container, cleanup } = await renderUserNav();

    const trigger = container.querySelector('button');
    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('John Doe');
    expect(document.body.textContent).toContain('john@example.com');

    await cleanup();
  });

  it('calls logout with login returnTo when log out is clicked', async () => {
    useAuth0Mock.mockReturnValue({
      isAuthenticated: true,
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      logout: logoutMock,
    });

    const { container, cleanup } = await renderUserNav();

    const trigger = container.querySelector('button');
    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const logoutButton = Array.from(document.body.querySelectorAll('button')).find(button =>
      /log out/i.test(button.textContent ?? ''),
    );
    expect(logoutButton).toBeTruthy();

    await act(async () => {
      logoutButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(logoutMock).toHaveBeenCalledWith({
      logoutParams: {
        returnTo: `${window.location.origin}${ROUTES.LOGIN}`,
      },
    });

    await cleanup();
  });

  it('labels the business-scope picker from the unscoped membership query', async () => {
    useAuth0Mock.mockReturnValue({
      isAuthenticated: true,
      user: { name: 'John Doe', email: 'john@example.com' },
      logout: logoutMock,
    });
    // What the scoped UserContext query can see: only the in-scope business is named.
    const userContext: UserInfo = {
      ...baseUserContext,
      context: {
        ...baseUserContext.context,
        memberships: [
          { businessId: 'business-1', role: 'business_owner', businessName: 'Acme' },
          { businessId: 'business-2', role: 'accountant', businessName: null },
        ],
      },
    };
    useMyMembershipsMock.mockReturnValue({
      fetching: false,
      memberships: [
        { businessId: 'business-1', businessName: 'Acme' },
        { businessId: 'business-2', businessName: 'Globex' },
      ],
    });

    const { container, cleanup } = await renderUserNav(userContext);

    const labels = [...container.querySelectorAll('[data-slot="business-scope-options"] li')].map(
      item => item.textContent,
    );
    expect(labels).toEqual(['Acme', 'Globex']);

    await cleanup();
  });

  it('falls back to the user context memberships when the unscoped query yields nothing', async () => {
    useAuth0Mock.mockReturnValue({
      isAuthenticated: true,
      user: { name: 'John Doe', email: 'john@example.com' },
      logout: logoutMock,
    });
    const userContext: UserInfo = {
      ...baseUserContext,
      context: {
        ...baseUserContext.context,
        memberships: [
          { businessId: 'business-1', role: 'business_owner', businessName: 'Acme' },
          { businessId: 'business-2', role: 'accountant', businessName: null },
        ],
      },
    };
    // In flight, or the caller's role is outside the query's gate.
    useMyMembershipsMock.mockReturnValue({ fetching: true, memberships: [] });

    const { container, cleanup } = await renderUserNav(userContext);

    const labels = [...container.querySelectorAll('[data-slot="business-scope-options"] li')].map(
      item => item.textContent,
    );
    expect(labels).toEqual(['Acme', 'Unknown']);

    await cleanup();
  });
});
