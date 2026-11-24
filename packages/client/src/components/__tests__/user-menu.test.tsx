// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserNav } from '../layout/user-nav.js';
import { UserContext, type UserInfo } from '../../providers/index.js';
import { ROUTES } from '../../router/routes.js';

const {
  useAuth0Mock,
  logoutMock,
  useMyMembershipsMock,
  getBusinessScopeIdsMock,
  setBusinessScopeMock,
} = vi.hoisted(() => ({
  useAuth0Mock: vi.fn(),
  logoutMock: vi.fn(),
  useMyMembershipsMock: vi.fn(),
  getBusinessScopeIdsMock: vi.fn<() => string[]>(),
  setBusinessScopeMock: vi.fn<(ids: string[]) => void>(),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

vi.mock('../../hooks/use-my-memberships.js', () => ({
  useMyMemberships: useMyMembershipsMock,
}));

// The applied scope lives in the urql provider's module state; these stand in for it.
vi.mock('../../providers/urql.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../providers/urql.js')>()),
  getBusinessScopeIds: getBusinessScopeIdsMock,
  setBusinessScope: setBusinessScopeMock,
}));

vi.mock('../common/modals/balance-charge-modal.js', () => ({
  BalanceChargeModal: () => null,
}));

// Stand-in for the business-scope picker, so tests can assert what it offers and drive it without
// a real popover. Like the real one it keeps its own selection, seeded from `defaultValue`, reports
// every toggle through `onValueChange`, and reports closing through `onOpenChange`.
vi.mock('../common/inputs/multi-select.js', async () => {
  const { useState } = await import('react');
  return {
    MultiSelect: ({
      options,
      defaultValue = [],
      onValueChange,
      onOpenChange,
    }: {
      options: Array<{ value: string; label: string }>;
      defaultValue?: string[];
      onValueChange: (value: string[]) => void;
      onOpenChange?: (open: boolean) => void;
    }) => {
      const [selected, setSelected] = useState(defaultValue);
      const toggle = (value: string) => {
        const next = selected.includes(value)
          ? selected.filter(id => id !== value)
          : [...selected, value];
        setSelected(next);
        onValueChange(next);
      };
      return (
        <div data-slot="business-scope-picker">
          <ul data-slot="business-scope-options">
            {options.map(option => (
              <li key={option.value}>
                <button data-option={option.value} onClick={() => toggle(option.value)}>
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
          <button data-slot="close-picker" onClick={() => onOpenChange?.(false)}>
            Close
          </button>
        </div>
      );
    },
  };
});

vi.mock('../ui/avatar.js', () => ({
  Avatar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) => (
    <img data-slot="avatar-image" src={src} alt={alt} />
  ),
  AvatarFallback: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../ui/dropdown-menu.js', () => ({
  // The close button stands in for Radix dismissing the menu (outside click, Escape, an item).
  DropdownMenu: ({
    children,
    onOpenChange,
  }: {
    children?: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div>
      {children}
      <button data-slot="close-menu" onClick={() => onOpenChange?.(false)} />
    </div>
  ),
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../common/modals/sync-green-invoice-documents-modal.js', () => ({
  SyncDocumentsModal: () => null,
}));

vi.mock('../common/tooltip.js', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock('../common/buttons/logout-button.js', () => ({
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
}));

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

function contextWithRole(role: string): UserInfo {
  return {
    ...baseUserContext,
    context: {
      ...baseUserContext.context,
      adminBusinessId: 'business-1',
      activeReadScope: ['business-1'],
      memberships: [{ businessId: 'business-1', role, businessName: 'Acme' }],
    },
  };
}

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
        React.createElement(MemoryRouter, null, React.createElement(UserNav)),
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
    getBusinessScopeIdsMock.mockReturnValue([]);
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

  it('links to the manual automations screen instead of running the jobs from the menu', async () => {
    useAuth0Mock.mockReturnValue({
      isAuthenticated: true,
      user: { name: 'John Doe', email: 'john@example.com' },
      logout: logoutMock,
    });

    const { container, cleanup } = await renderUserNav(contextWithRole('business_owner'));

    const link = container.querySelector(`a[href="${ROUTES.CHARGES.MANUAL_AUTOMATIONS}"]`);
    expect(link?.textContent).toContain('Manual Automations');
    // the Deel pull is one of the automations now, not a menu item of its own
    expect(container.textContent).not.toContain('Pull Deel Documents');

    await cleanup();
  });

  it.each(['accountant', 'employee'])(
    'hides manual automations from a %s, whom the server would refuse',
    async role => {
      useAuth0Mock.mockReturnValue({
        isAuthenticated: true,
        user: { name: 'John Doe', email: 'john@example.com' },
        logout: logoutMock,
      });

      const { container, cleanup } = await renderUserNav(contextWithRole(role));

      expect(container.querySelector(`a[href="${ROUTES.CHARGES.MANUAL_AUTOMATIONS}"]`)).toBeNull();
      expect(container.textContent).not.toContain('Manual Automations');

      await cleanup();
    },
  );

  it('hides manual automations when the scope includes a business the user does not own', async () => {
    useAuth0Mock.mockReturnValue({
      isAuthenticated: true,
      user: { name: 'John Doe', email: 'john@example.com' },
      logout: logoutMock,
    });
    const userContext: UserInfo = {
      ...baseUserContext,
      context: {
        ...baseUserContext.context,
        adminBusinessId: 'business-1',
        activeReadScope: ['business-1', 'business-2'],
        memberships: [
          { businessId: 'business-1', role: 'business_owner', businessName: 'Acme' },
          { businessId: 'business-2', role: 'accountant', businessName: 'Globex' },
        ],
      },
    };

    const { container, cleanup } = await renderUserNav(userContext);

    expect(container.textContent).not.toContain('Manual Automations');

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

describe('UserNav business scope picker', () => {
  const memberships = [
    { businessId: 'business-1', role: 'business_owner', businessName: 'Acme' },
    { businessId: 'business-2', role: 'business_owner', businessName: 'Globex' },
    { businessId: 'business-3', role: 'accountant', businessName: 'Initech' },
  ];
  const userContext: UserInfo = {
    ...baseUserContext,
    context: { ...baseUserContext.context, memberships },
  };

  let appliedScope: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth0Mock.mockReturnValue({
      isAuthenticated: true,
      user: { name: 'John Doe', email: 'john@example.com' },
      logout: logoutMock,
    });
    useMyMembershipsMock.mockReturnValue({ fetching: false, memberships: [] });
    // Mirror the provider: what `setBusinessScope` stores is what `getBusinessScopeIds` reads.
    appliedScope = [];
    getBusinessScopeIdsMock.mockImplementation(() => appliedScope);
    setBusinessScopeMock.mockImplementation(ids => {
      appliedScope = ids;
    });
  });

  async function click(container: HTMLElement, selector: string): Promise<void> {
    const element = container.querySelector<HTMLElement>(selector);
    expect(element, selector).toBeTruthy();
    await act(async () => {
      element?.click();
      await Promise.resolve();
    });
  }

  const toggle = (container: HTMLElement, businessId: string) =>
    click(container, `[data-option="${businessId}"]`);

  it('keeps the menu open while toggling businesses and applies the scope once, on close', async () => {
    const { container, cleanup } = await renderUserNav(userContext);
    const picker = container.querySelector('[data-slot="business-scope-picker"]');
    expect(picker).toBeTruthy();

    await toggle(container, 'business-1');
    await toggle(container, 'business-3');
    await toggle(container, 'business-2');

    // Applying swaps the urql client, which remounts the app shell and this menu with it.
    expect(setBusinessScopeMock).not.toHaveBeenCalled();
    expect(picker?.isConnected).toBe(true);
    expect(container.querySelector('[data-slot="business-scope-picker"]')).toBe(picker);

    await click(container, '[data-slot="close-picker"]');

    expect(setBusinessScopeMock).toHaveBeenCalledTimes(1);
    expect(setBusinessScopeMock).toHaveBeenCalledWith(['business-1', 'business-3', 'business-2']);

    // The menu closing next has nothing left to apply.
    await click(container, '[data-slot="close-menu"]');
    expect(setBusinessScopeMock).toHaveBeenCalledTimes(1);

    await cleanup();
  });

  it('applies a pending selection when the menu closes with the picker still open', async () => {
    const { container, cleanup } = await renderUserNav(userContext);

    await toggle(container, 'business-2');
    await click(container, '[data-slot="close-menu"]');

    expect(setBusinessScopeMock).toHaveBeenCalledTimes(1);
    expect(setBusinessScopeMock).toHaveBeenCalledWith(['business-2']);

    await cleanup();
  });

  it('does not apply a selection that ends where it started', async () => {
    appliedScope = ['business-1'];
    const { container, cleanup } = await renderUserNav(userContext);

    await toggle(container, 'business-2');
    await toggle(container, 'business-2');
    await click(container, '[data-slot="close-picker"]');
    await click(container, '[data-slot="close-menu"]');

    expect(setBusinessScopeMock).not.toHaveBeenCalled();

    await cleanup();
  });

  it('applies a reordered selection, since the order picks the write target', async () => {
    appliedScope = ['business-1', 'business-2'];
    const { container, cleanup } = await renderUserNav(userContext);

    await toggle(container, 'business-1');
    await toggle(container, 'business-1');
    await click(container, '[data-slot="close-picker"]');

    expect(setBusinessScopeMock).toHaveBeenCalledTimes(1);
    expect(setBusinessScopeMock).toHaveBeenCalledWith(['business-2', 'business-1']);

    await cleanup();
  });

  it('applies "All businesses" when every business is deselected', async () => {
    appliedScope = ['business-1'];
    const { container, cleanup } = await renderUserNav(userContext);

    await toggle(container, 'business-1');
    await click(container, '[data-slot="close-picker"]');

    expect(setBusinessScopeMock).toHaveBeenCalledTimes(1);
    expect(setBusinessScopeMock).toHaveBeenCalledWith([]);

    await cleanup();
  });
});
