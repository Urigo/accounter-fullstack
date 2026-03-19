// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuth0Mock } = vi.hoisted(() => ({
  useAuth0Mock: vi.fn(),
}));

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

vi.mock('urql', () => ({
  useQuery: useQueryMock,
}));

vi.mock('@mantine/hooks', () => ({
  useDisclosure: () => [false, { close: vi.fn(), open: vi.fn() }],
}));

vi.mock('../layout/user-nav.js', () => ({
  UserNav: () => React.createElement('div', { 'data-testid': 'user-nav' }, 'UserNav'),
}));

vi.mock('../layout/mobile-sidebar.js', () => ({
  MobileSidebar: () => React.createElement('div', null, 'MobileSidebar'),
}));

vi.mock('../layout/setup-indicator.js', () => ({
  SetupIndicator: () => null,
}));

vi.mock('../layout/source-health.js', () => ({
  SourceHealthBadge: () => null,
}));

const { useWorkspaceDisplayNameMock, useWorkspaceLogoMock } = vi.hoisted(() => ({
  useWorkspaceDisplayNameMock: vi.fn(),
  useWorkspaceLogoMock: vi.fn(),
}));

vi.mock('../../providers/workspace-provider.js', () => ({
  useWorkspaceDisplayName: useWorkspaceDisplayNameMock,
  useWorkspaceLogo: useWorkspaceLogoMock,
}));

import { Header } from '../layout/header.js';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

async function renderHeader(workspaceData: {
  companyName: string | null;
  logoUrl: string | null;
} | null) {
  useAuth0Mock.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    user: { email: 'test@test.com', name: 'Test User' },
    getAccessTokenSilently: vi.fn(),
  });

  useWorkspaceDisplayNameMock.mockReturnValue(workspaceData?.companyName || 'Accounter');
  useWorkspaceLogoMock.mockReturnValue(workspaceData?.logoUrl || null);

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: React.createElement(Header),
      },
    ],
    { initialEntries: ['/'] },
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

  return { html, cleanup };
}

describe('Workspace Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays workspace company name when set', async () => {
    const { html, cleanup } = await renderHeader({
      companyName: 'Acme Corp',
      logoUrl: null,
    });

    expect(html).toContain('Acme Corp');
    await cleanup();
  });

  it('falls back to "Accounter" when no workspace settings exist', async () => {
    const { html, cleanup } = await renderHeader(null);

    expect(html).toContain('Accounter');
    await cleanup();
  });

  it('falls back to "Accounter" when company name is null', async () => {
    const { html, cleanup } = await renderHeader({
      companyName: null,
      logoUrl: null,
    });

    expect(html).toContain('Accounter');
    await cleanup();
  });

  it('renders logo image when logoUrl is set', async () => {
    const { html, cleanup } = await renderHeader({
      companyName: 'Acme Corp',
      logoUrl: 'https://example.com/logo.png',
    });

    expect(html).toContain('https://example.com/logo.png');
    expect(html).toContain('img');
    await cleanup();
  });

  it('renders fallback icon when no logo is set', async () => {
    const { html, cleanup } = await renderHeader({
      companyName: 'Acme Corp',
      logoUrl: null,
    });

    // No img tag for logo, should have the Building2 icon (rendered as svg)
    expect(html).toContain('svg');
    expect(html).not.toContain('example.com/logo');
    await cleanup();
  });
});
