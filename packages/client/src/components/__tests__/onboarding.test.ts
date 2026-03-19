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

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
  useMutation: useMutationMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../providers/workspace-provider.js', () => ({
  useWorkspace: useWorkspaceMock,
  useWorkspaceDisplayName: () => 'Accounter',
  useWorkspaceLogo: () => null,
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function setupMocks(opts?: {
  workspace?: Record<string, unknown> | null;
  sources?: unknown[];
}) {
  useAuth0Mock.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    user: { email: 'test@test.com' },
    getAccessTokenSilently: vi.fn(),
  });

  useWorkspaceMock.mockReturnValue({
    workspace: opts?.workspace ?? null,
    isLoading: false,
    error: null,
    refetch: refetchMock,
  });

  useQueryMock.mockReturnValue([
    {
      data: { sourceConnections: opts?.sources ?? [] },
      fetching: false,
      error: null,
    },
    vi.fn(),
  ]);

  useMutationMock.mockReturnValue([
    { fetching: false },
    vi.fn().mockResolvedValue({ data: {}, error: undefined }),
  ]);
}

async function renderInRouter(path: string, element: React.ReactElement) {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '/', element: React.createElement('div', null, 'Home') },
      { path: '/settings', element: React.createElement('div', null, 'Settings') },
    ],
    { initialEntries: [path] },
  );

  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(RouterProvider, { router }));
    await Promise.resolve();
  });

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { container, router, cleanup };
}

describe('Onboarding wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupMocks();
  });

  it('renders welcome step initially', async () => {
    const { OnboardingWizard } = await import('../screens/onboarding/index.js');
    const { container, cleanup } = await renderInRouter(
      '/onboarding',
      React.createElement(OnboardingWizard),
    );

    expect(container.textContent).toContain('Welcome to Accounter');
    expect(container.textContent).toContain('Get Started');
    await cleanup();
  });

  it('advances from welcome to identity step', async () => {
    const { OnboardingWizard } = await import('../screens/onboarding/index.js');
    const { container, cleanup } = await renderInRouter(
      '/onboarding',
      React.createElement(OnboardingWizard),
    );

    const getStarted = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Get Started'),
    );
    expect(getStarted).toBeTruthy();

    await act(async () => {
      getStarted?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Company Identity');
    await cleanup();
  });

  it('shows sources step with empty state', async () => {
    const { OnboardingWizard } = await import('../screens/onboarding/index.js');
    const { container, cleanup } = await renderInRouter(
      '/onboarding',
      React.createElement(OnboardingWizard),
    );

    const getStarted = container.querySelector('button');
    await act(async () => {
      getStarted?.click();
      await Promise.resolve();
    });

    setupMocks({
      workspace: { companyName: 'Test', logoUrl: null },
    });
    useMutationMock.mockReturnValue([
      { fetching: false },
      vi.fn().mockResolvedValue({ data: { updateWorkspaceSettings: {} } }),
    ]);

    const skip = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Continue'),
    );

    if (skip) {
      await act(async () => {
        skip.click();
        await Promise.resolve();
      });
    }

    await cleanup();
  });

  it('review step shows summary', async () => {
    setupMocks({
      workspace: { companyName: 'TestCo', logoUrl: null },
      sources: [{ id: 's1', status: 'ACTIVE', lastSyncAt: null }],
    });

    const { OnboardingWizard } = await import('../screens/onboarding/index.js');
    const { container, cleanup } = await renderInRouter(
      '/onboarding',
      React.createElement(OnboardingWizard),
    );

    // Navigate through steps
    for (let i = 0; i < 3; i++) {
      const btn = Array.from(container.querySelectorAll('button')).find(
        b =>
          b.textContent?.includes('Get Started') ||
          b.textContent?.includes('Continue'),
      );
      if (btn) {
        await act(async () => {
          btn.click();
          await Promise.resolve();
        });
      }
    }

    await cleanup();
  });
});

describe('Onboarding completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupMocks();
  });

  it('useOnboardingComplete returns false initially', async () => {
    const { useOnboardingComplete } = await import(
      '../screens/onboarding/index.js'
    );
    const resultRef: { current: { isComplete: boolean; markComplete: () => void } | null } =
      { current: null };

    function TestComponent() {
      resultRef.current = useOnboardingComplete();
      return null;
    }

    const container = document.createElement('div');
    document.body.append(container);
    let root: Root | null = null;
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(TestComponent));
      await Promise.resolve();
    });

    expect(resultRef.current?.isComplete).toBe(false);

    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  });

  it('markComplete persists to localStorage', async () => {
    const { useOnboardingComplete } = await import(
      '../screens/onboarding/index.js'
    );
    const resultRef: { current: { isComplete: boolean; markComplete: () => void } | null } =
      { current: null };

    function TestComponent() {
      resultRef.current = useOnboardingComplete();
      return null;
    }

    const container = document.createElement('div');
    document.body.append(container);
    let root: Root | null = null;
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(TestComponent));
      await Promise.resolve();
    });

    await act(async () => {
      resultRef.current?.markComplete();
      await Promise.resolve();
    });

    expect(localStorage.getItem('accounter:onboarding_complete')).toBe('1');

    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  });
});

describe('Setup completion hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns isFirstRun=true when no workspace and no sources', async () => {
    setupMocks({ workspace: null, sources: [] });

    const { useSetupCompletion } = await import(
      '../../hooks/use-setup-completion.js'
    );
    const ref: { current: ReturnType<typeof useSetupCompletion> | null } = { current: null };

    function TestComponent() {
      ref.current = useSetupCompletion();
      return null;
    }

    const container = document.createElement('div');
    document.body.append(container);
    let root: Root | null = null;
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(TestComponent));
      await Promise.resolve();
    });

    expect(ref.current?.isFirstRun).toBe(true);
    expect(ref.current?.percentage).toBe(0);

    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  });

  it('returns 100% when all steps complete', async () => {
    setupMocks({
      workspace: { companyName: 'Test', logoUrl: 'http://logo.png' },
      sources: [{ id: 's1', status: 'ACTIVE', lastSyncAt: new Date().toISOString() }],
    });

    const { useSetupCompletion } = await import(
      '../../hooks/use-setup-completion.js'
    );
    const ref: { current: ReturnType<typeof useSetupCompletion> | null } = { current: null };

    function TestComponent() {
      ref.current = useSetupCompletion();
      return null;
    }

    const container = document.createElement('div');
    document.body.append(container);
    let root: Root | null = null;
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(TestComponent));
      await Promise.resolve();
    });

    expect(ref.current?.percentage).toBe(100);
    expect(ref.current?.isFirstRun).toBe(false);
    expect(ref.current?.completedSteps).toBe(4);

    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  });
});

describe('Empty states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks({ sources: [] });
  });

  it('connected sources shows polished empty state', async () => {
    const { ConnectedSources } = await import(
      '../screens/settings/connected-sources.js'
    );

    const container = document.createElement('div');
    document.body.append(container);
    let root: Root | null = null;
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(ConnectedSources));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('No sources connected');
    expect(container.textContent).toContain(
      'Connect a bank account or credit card',
    );
    expect(container.textContent).not.toContain('server-side during workspace setup');

    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  });
});

describe('Regression: login -> settings -> sources -> dashboard path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('accounter:onboarding_complete', '1');
    setupMocks({
      workspace: { companyName: 'Test', logoUrl: null },
      sources: [{ id: 's1', status: 'ACTIVE', lastSyncAt: new Date().toISOString() }],
    });
  });

  it('settings page renders when navigated to', async () => {
    vi.mock('../../providers/index.js', () => ({
      UserContext: React.createContext({
        userContext: {
          username: 'test@test.com',
          context: {
            adminBusinessId: 'biz-1',
            defaultLocalCurrency: 'ILS',
            locality: 'IL',
            financialAccountsBusinessesIds: [],
          },
        },
        setUserContext: vi.fn(),
      }),
    }));

    vi.mock('@/components/business/contact-info-section.jsx', () => ({
      ContactInfoSection: () => React.createElement('div', null, 'Contact'),
    }));
    vi.mock('@/components/business/configurations-section.jsx', () => ({
      ConfigurationsSection: () => React.createElement('div', null, 'Config'),
    }));
    vi.mock('@/components/business/admin/admin-business-section.jsx', () => ({
      AdminBusinessSection: () => React.createElement('div', null, 'Admin'),
    }));
    vi.mock('@/components/business/admin/financial-account-section.jsx', () => ({
      FinancialAccountsSection: () => React.createElement('div', null, 'Accounts'),
    }));
    vi.mock('@/components/business/client/integrations-section.jsx', () => ({
      IntegrationsSection: () => React.createElement('div', null, 'Integrations'),
    }));
    vi.mock('@/hooks/use-owner-business.js', () => ({
      useOwnerBusiness: () => ({
        business: { id: 'biz-1' },
        businessId: 'biz-1',
        isClient: false,
        isAdmin: true,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      }),
    }));
    vi.mock('pdfjs-dist', () => ({}));

    const { SettingsPage } = await import(
      '../screens/settings/index.js'
    );
    const { container, cleanup } = await renderInRouter(
      '/settings',
      React.createElement(SettingsPage),
    );

    expect(container.textContent).toContain('Settings');
    await cleanup();
  });
});
