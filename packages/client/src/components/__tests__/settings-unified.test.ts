// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuth0Mock } = vi.hoisted(() => ({
  useAuth0Mock: vi.fn(),
}));

const { useQueryMock, useMutationMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
}));

const { useWorkspaceMock, refetchMock } = vi.hoisted(() => ({
  useWorkspaceMock: vi.fn(),
  refetchMock: vi.fn(),
}));

const { useOwnerBusinessMock } = vi.hoisted(() => ({
  useOwnerBusinessMock: vi.fn(),
}));

const { userContextRef } = vi.hoisted(() => ({
  userContextRef: {
    adminBusinessId: 'biz-1' as string | null,
    defaultLocalCurrency: 'ILS',
    locality: 'IL',
    financialAccountsBusinessesIds: [] as string[],
    roleId: 'business_owner' as string,
  },
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
  useMutation: useMutationMock,
}));

vi.mock('pdfjs-dist', () => ({}));

vi.mock('../../providers/workspace-provider.js', () => ({
  useWorkspace: useWorkspaceMock,
  useWorkspaceDisplayName: () => 'Test Corp',
  useWorkspaceLogo: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/business/contact-info-section.jsx', () => ({
  ContactInfoSection: (props: Record<string, unknown>) =>
    React.createElement(
      'div',
      { 'data-testid': 'contact-section' },
      `ContactInfo:${props.data ? 'loaded' : 'empty'}`,
    ),
}));

vi.mock('@/components/business/configurations-section.jsx', () => ({
  ConfigurationsSection: (props: Record<string, unknown>) =>
    React.createElement(
      'div',
      { 'data-testid': 'config-section' },
      `Config:${props.data ? 'loaded' : 'empty'}`,
    ),
}));

vi.mock('@/components/business/admin/admin-business-section.jsx', () => ({
  AdminBusinessSection: (props: Record<string, unknown>) =>
    React.createElement(
      'div',
      { 'data-testid': 'admin-section' },
      `Admin:${props.data ? 'loaded' : 'empty'}`,
    ),
}));

vi.mock('@/components/business/admin/financial-account-section.jsx', () => ({
  FinancialAccountsSection: (props: Record<string, unknown>) =>
    React.createElement(
      'div',
      { 'data-testid': 'accounts-section' },
      `Accounts:${props.adminId || 'none'}`,
    ),
}));

vi.mock('@/components/business/client/integrations-section.jsx', () => ({
  IntegrationsSection: (props: Record<string, unknown>) =>
    React.createElement(
      'div',
      { 'data-testid': 'integrations-section' },
      `Integrations:${props.data ? 'loaded' : 'empty'}`,
    ),
}));

vi.mock('@/hooks/use-owner-business.js', () => ({
  useOwnerBusiness: useOwnerBusinessMock,
}));

vi.mock('../screens/settings/tabs/team-tab.js', () => ({
  TeamTab: () =>
    React.createElement('div', { 'data-testid': 'team-tab' }, 'Team management'),
}));

vi.mock('../../providers/index.js', () => ({
  UserContext: React.createContext({
    userContext: {
      username: 'test@test.com',
      context: userContextRef,
    },
    setUserContext: vi.fn(),
  }),
}));

import { SettingsPage } from '../screens/settings/index.js';
import { CompanyTab } from '../screens/settings/tabs/company-tab.js';
import { SourcesTab } from '../screens/settings/tabs/sources-tab.js';
import { RulesTab } from '../screens/settings/tabs/rules-tab.js';
import { TaxAdminTab } from '../screens/settings/tabs/tax-admin-tab.js';
import { FinanceTab } from '../screens/settings/tabs/finance-tab.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function setupDefaultMocks() {
  useAuth0Mock.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    user: { email: 'test@test.com' },
    getAccessTokenSilently: vi.fn(),
  });

  useWorkspaceMock.mockReturnValue({
    workspace: {
      id: 'ws-1',
      ownerId: 'biz-1',
      companyName: 'Test Corp',
      logoUrl: null,
      defaultCurrency: 'ILS',
      agingThresholdDays: 30,
      matchingToleranceAmount: 0.01,
      billingCurrency: null,
      billingPaymentTermsDays: 30,
    },
    isLoading: false,
    error: null,
    refetch: refetchMock,
  });

  useOwnerBusinessMock.mockReturnValue({
    business: { id: 'biz-1', clientInfo: { id: 'c1' }, adminInfo: { id: 'a1' } },
    businessId: 'biz-1',
    isClient: true,
    isAdmin: true,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });

  useQueryMock.mockReturnValue([
    { data: { sourceConnections: [] }, fetching: false, error: null },
    vi.fn(),
  ]);

  useMutationMock.mockReturnValue([{ fetching: false }, vi.fn()]);
}

async function render(component: React.ReactElement) {
  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(component);
    await Promise.resolve();
  });
  const html = container.innerHTML;
  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };
  return { container, html, cleanup };
}

async function renderSettingsInRouter(initialSearch = '') {
  const router = createMemoryRouter(
    [{ path: '/settings', element: React.createElement(SettingsPage) }],
    { initialEntries: [`/settings${initialSearch}`] },
  );
  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(RouterProvider, { router }));
    await Promise.resolve();
  });
  const html = container.innerHTML;
  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };
  return { container, html, router, cleanup };
}

describe('Settings shell structure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('renders 5 tab triggers for admin users (Company, Team, Rules, Tax, Preferences)', async () => {
    const { container, cleanup } = await renderSettingsInRouter();
    const triggers = container.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(5);
    const labels = Array.from(triggers).map(t => t.textContent);
    expect(labels).toContain('Company');
    expect(labels).toContain('Team');
    expect(labels).not.toContain('Sources');
    expect(labels).toContain('Rules');
    expect(labels).toContain('Tax');
    expect(labels).toContain('Preferences');
    await cleanup();
  });

  it('renders page header with workspace branding', async () => {
    const { html, cleanup } = await renderSettingsInRouter();
    expect(html).toContain('Settings');
    expect(html).toContain('Test Corp workspace configuration');
    await cleanup();
  });
});

describe('Permission-aware tab visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    userContextRef.adminBusinessId = null;
    userContextRef.roleId = 'employee';
  });

  afterEach(() => {
    userContextRef.adminBusinessId = 'biz-1';
    userContextRef.roleId = 'business_owner';
  });

  it('non-admin users see only 2 tabs (Company, Preferences - no Sources tab)', async () => {
    const { container, cleanup } = await renderSettingsInRouter();
    const triggers = container.querySelectorAll('[data-slot="tabs-trigger"]');
    expect(triggers.length).toBe(2);
    const labels = Array.from(triggers).map(t => t.textContent);
    expect(labels).toContain('Company');
    expect(labels).toContain('Preferences');
    expect(labels).not.toContain('Sources');
    expect(labels).not.toContain('Rules');
    expect(labels).not.toContain('Tax');
    await cleanup();
  });

  it('falls back to company tab when non-admin visits admin-only tab URL', async () => {
    const { container, cleanup } = await renderSettingsInRouter('?tab=tax');
    const triggers = container.querySelectorAll('[data-slot="tabs-trigger"]');
    const active = Array.from(triggers).find(t => t.getAttribute('data-state') === 'active');
    expect(active?.textContent).toContain('Company');
    await cleanup();
  });
});

describe('Company tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('renders workspace profile form and reused contact section', async () => {
    const { html, cleanup } = await render(React.createElement(CompanyTab));
    expect(html).toContain('Company Profile');
    expect(html).toContain('Business Contact Details');
    expect(html).toContain('ContactInfo:loaded');
    await cleanup();
  });

  it('passes business data to ContactInfoSection', async () => {
    const { container, cleanup } = await render(React.createElement(CompanyTab));
    const section = container.querySelector('[data-testid="contact-section"]');
    expect(section).toBeTruthy();
    expect(section?.textContent).toContain('loaded');
    await cleanup();
  });

  it('shows loading state while business loads', async () => {
    useOwnerBusinessMock.mockReturnValue({
      business: null,
      businessId: '',
      isClient: false,
      isAdmin: false,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { html, cleanup } = await render(React.createElement(CompanyTab));
    expect(html).toContain('animate-spin');
    await cleanup();
  });
});

describe('Sources tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('renders source connections and reused financial accounts', async () => {
    const { html, cleanup } = await render(React.createElement(SourcesTab));
    expect(html).toContain('Financial Accounts');
    expect(html).toContain('Accounts:biz-1');
    await cleanup();
  });

  it('renders reused integrations section when isClient', async () => {
    const { html, cleanup } = await render(React.createElement(SourcesTab));
    expect(html).toContain('Integrations');
    expect(html).toContain('Integrations:loaded');
    await cleanup();
  });

  it('hides integrations when not a client', async () => {
    useOwnerBusinessMock.mockReturnValue({
      business: { id: 'biz-1', adminInfo: { id: 'a1' } },
      businessId: 'biz-1',
      isClient: false,
      isAdmin: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { html, cleanup } = await render(React.createElement(SourcesTab));
    expect(html).toContain('Accounts:biz-1');
    expect(html).not.toContain('Integrations:loaded');
    await cleanup();
  });

  it('hides financial accounts when not admin', async () => {
    useOwnerBusinessMock.mockReturnValue({
      business: { id: 'biz-1', clientInfo: { id: 'c1' } },
      businessId: 'biz-1',
      isClient: true,
      isAdmin: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { html, cleanup } = await render(React.createElement(SourcesTab));
    expect(html).not.toContain('Accounts:');
    expect(html).toContain('Integrations:loaded');
    await cleanup();
  });
});

describe('Rules tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('renders reused configurations section', async () => {
    const { html, cleanup } = await render(React.createElement(RulesTab));
    expect(html).toContain('Rules and Matching');
    expect(html).toContain('Config:loaded');
    await cleanup();
  });

  it('shows empty state when no business', async () => {
    useOwnerBusinessMock.mockReturnValue({
      business: null,
      businessId: '',
      isClient: false,
      isAdmin: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { html, cleanup } = await render(React.createElement(RulesTab));
    expect(html).toContain('No business configuration available');
    await cleanup();
  });
});

describe('Tax & Admin tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('renders reused admin business section', async () => {
    const { html, cleanup } = await render(React.createElement(TaxAdminTab));
    expect(html).toContain('Tax and Administration');
    expect(html).toContain('Admin:loaded');
    await cleanup();
  });

  it('shows unavailable message when not admin', async () => {
    useOwnerBusinessMock.mockReturnValue({
      business: { id: 'biz-1' },
      businessId: 'biz-1',
      isClient: false,
      isAdmin: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { html, cleanup } = await render(React.createElement(TaxAdminTab));
    expect(html).toContain('not available');
    await cleanup();
  });
});

describe('Preferences tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('renders finance preferences form', async () => {
    const { html, cleanup } = await render(React.createElement(FinanceTab));
    expect(html).toContain('Finance Preferences');
    expect(html).toContain('Currency and Accounting');
    await cleanup();
  });
});

describe('No secrets exposed in any tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  const sensitiveTokens = [
    '.env',
    'SETTINGS_ENCRYPTION_KEY',
    'POSTGRES_',
    'AUTH0_',
    'HIVE_TOKEN',
    'credentials_encrypted',
  ];

  for (const TabComponent of [CompanyTab, SourcesTab, RulesTab, TaxAdminTab, FinanceTab]) {
    it(`${TabComponent.name} does not expose sensitive data`, async () => {
      const { html, cleanup } = await render(React.createElement(TabComponent));
      for (const token of sensitiveTokens) {
        expect(html).not.toContain(token);
      }
      await cleanup();
    });
  }
});

describe('Sources page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth0Mock.mockReturnValue({ isAuthenticated: true, isLoading: false });
    useQueryMock.mockReturnValue([{ data: { sourceConnections: [] }, fetching: false, error: null }, vi.fn()]);
    useMutationMock.mockReturnValue([{ fetching: false }, vi.fn().mockResolvedValue({ data: {}, error: undefined })]);
  });

  it('/sources renders the Sources & Credentials page (not a redirect)', async () => {
    const { SourcesPage } = await import('../screens/sources/index.js');

    const router = createMemoryRouter(
      [{ path: '/sources', element: React.createElement(SourcesPage) }],
      { initialEntries: ['/sources'] },
    );

    const container = document.createElement('div');
    document.body.append(container);
    let root: Root | null = null;
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(RouterProvider, { router }));
      await Promise.resolve();
    });

    // Should stay on /sources, not redirect
    expect(router.state.location.pathname).toBe('/sources');
    // Should render the Sources & Credentials heading
    expect(container.innerHTML).toContain('Sources');

    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  });
});

describe('Canonical path integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('reused components receive the same data shape as the original business page', async () => {
    const mockBusiness = {
      id: 'biz-1',
      clientInfo: { id: 'c1' },
      adminInfo: { id: 'a1' },
    };

    useOwnerBusinessMock.mockReturnValue({
      business: mockBusiness,
      businessId: 'biz-1',
      isClient: true,
      isAdmin: true,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { container: companyContainer, cleanup: c1 } = await render(
      React.createElement(CompanyTab),
    );
    expect(
      companyContainer.querySelector('[data-testid="contact-section"]')?.textContent,
    ).toContain('loaded');
    await c1();

    const { container: rulesContainer, cleanup: c2 } = await render(
      React.createElement(RulesTab),
    );
    expect(
      rulesContainer.querySelector('[data-testid="config-section"]')?.textContent,
    ).toContain('loaded');
    await c2();

    const { container: taxContainer, cleanup: c3 } = await render(
      React.createElement(TaxAdminTab),
    );
    expect(
      taxContainer.querySelector('[data-testid="admin-section"]')?.textContent,
    ).toContain('loaded');
    await c3();
  });
});
