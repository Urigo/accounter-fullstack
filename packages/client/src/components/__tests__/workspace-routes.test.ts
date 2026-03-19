// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../router/routes.js';

const { useAuth0Mock } = vi.hoisted(() => ({
  useAuth0Mock: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

import { Outlet } from 'react-router-dom';
import { ProtectedRoute } from '../../router/guards/auth-guards.js';

function ProtectedLayout() {
  return React.createElement(
    ProtectedRoute,
    null,
    React.createElement(Outlet),
  );
}

async function renderWithAuth(
  pathname: string,
  authState: { isAuthenticated: boolean; isLoading: boolean },
) {
  useAuth0Mock.mockReturnValue(authState);

  const router = createMemoryRouter(
    [
      {
        path: ROUTES.LOGIN,
        element: React.createElement('div', null, 'Login Page'),
      },
      {
        path: '/',
        element: React.createElement(ProtectedLayout),
        children: [
          {
            index: true,
            element: React.createElement('div', null, 'Dashboard'),
          },
          {
            path: 'sources',
            element: React.createElement('div', null, 'Sources Page'),
          },
          {
            path: 'settings',
            element: React.createElement('div', null, 'Settings Page'),
          },
        ],
      },
    ],
    { initialEntries: [pathname] },
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

  return { html, router, cleanup };
}

describe('Workspace Route Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authenticated user lands on dashboard at /', async () => {
    const { html, router, cleanup } = await renderWithAuth('/', {
      isAuthenticated: true,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe('/');
    expect(html).toContain('Dashboard');
    await cleanup();
  });

  it('unauthenticated user on /sources is redirected to /login', async () => {
    const { router, cleanup } = await renderWithAuth('/sources', {
      isAuthenticated: false,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
    await cleanup();
  });

  it('unauthenticated user on /settings is redirected to /login', async () => {
    const { router, cleanup } = await renderWithAuth('/settings', {
      isAuthenticated: false,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
    await cleanup();
  });

  it('authenticated user can access /sources', async () => {
    const { html, router, cleanup } = await renderWithAuth('/sources', {
      isAuthenticated: true,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe('/sources');
    expect(html).toContain('Sources Page');
    await cleanup();
  });

  it('authenticated user can access /settings', async () => {
    const { html, router, cleanup } = await renderWithAuth('/settings', {
      isAuthenticated: true,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe('/settings');
    expect(html).toContain('Settings Page');
    await cleanup();
  });

  it('preserves return path when redirecting to login', async () => {
    const { router, cleanup } = await renderWithAuth('/settings', {
      isAuthenticated: false,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
    expect(router.state.location.state).toEqual({ returnTo: '/settings' });
    await cleanup();
  });
});

describe('Route definitions', () => {
  it('ROUTES includes sources and settings', () => {
    expect(ROUTES.SOURCES).toBe('/sources');
    expect(ROUTES.SETTINGS).toBe('/settings');
  });
});
