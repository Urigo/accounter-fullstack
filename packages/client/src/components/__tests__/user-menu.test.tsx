// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserNav } from '../layout/user-nav.js';
import { UserContext, type UserInfo } from '../../providers/index.js';
import { ROUTES } from '../../router/routes.js';

const { useAuth0Mock, executeJobsMock, logoutMock } = vi.hoisted(() => ({
  useAuth0Mock: vi.fn(),
  executeJobsMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

vi.mock('../../hooks/use-corn-jobs.js', () => ({
  useCornJobs: () => ({ executeJobs: executeJobsMock }),
}));

vi.mock('../common/modals/balance-charge-modal.js', () => ({
  BalanceChargeModal: () => null,
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
    locality: 'IL',
    roleId: 'business_owner',
  },
};

async function renderUserNav() {
  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          UserContext.Provider,
          {
            value: {
              userContext: baseUserContext,
              setUserContext: () => void 0,
            },
          },
          React.createElement(UserNav),
        ),
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

  it('does not show duplicate settings link in user menu', async () => {
    useAuth0Mock.mockReturnValue({
      isAuthenticated: true,
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      logout: logoutMock,
    });

    const { container, cleanup } = await renderUserNav();
    expect(container.textContent).not.toContain('Workspace Settings');
    expect(container.textContent).not.toContain('Admin Configurations');
    const settingsLink = container.querySelector('a[href="/settings"]');
    expect(settingsLink).toBeNull();
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
});
