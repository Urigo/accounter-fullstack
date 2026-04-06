// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute, PublicOnlyGuard } from '../../router/guards/auth-guards.js';
import { ROUTES } from '../../router/routes.js';

const { useAuth0Mock } = vi.hoisted(() => ({
  useAuth0Mock: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

async function renderProtectedPath(pathname: string, authState: AuthState) {
  useAuth0Mock.mockReturnValue(authState);

  const router = createMemoryRouter(
    [
      {
        path: ROUTES.LOGIN,
        element: React.createElement('div', null, 'Login Page'),
      },
      {
        path: ROUTES.CHARGES.ROOT,
        element: React.createElement(
          ProtectedRoute,
          null,
          React.createElement('div', null, 'Charges Page'),
        ),
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

async function renderPublicPath(pathname: string, authState: AuthState) {
  useAuth0Mock.mockReturnValue(authState);

  const router = createMemoryRouter(
    [
      {
        path: ROUTES.LOGIN,
        element: React.createElement(
          PublicOnlyGuard,
          null,
          React.createElement('div', null, 'Login Page'),
        ),
      },
      {
        path: ROUTES.HOME,
        element: React.createElement('div', null, 'Home Page'),
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

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to /login', async () => {
    const { router, cleanup } = await renderProtectedPath(ROUTES.CHARGES.ROOT, {
      isAuthenticated: false,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
    await cleanup();
  });

  it('preserves attempted path in returnTo state', async () => {
    const { router, cleanup } = await renderProtectedPath(ROUTES.CHARGES.ROOT, {
      isAuthenticated: false,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
    expect(router.state.location.state).toEqual({ returnTo: ROUTES.CHARGES.ROOT });
    await cleanup();
  });

  it('allows authenticated users to access protected route', async () => {
    const { html, router, cleanup } = await renderProtectedPath(ROUTES.CHARGES.ROOT, {
      isAuthenticated: true,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe(ROUTES.CHARGES.ROOT);
    expect(html).toContain('Charges Page');
    await cleanup();
  });

  it('renders loading state while auth is loading', async () => {
    const { html, router, cleanup } = await renderProtectedPath(ROUTES.CHARGES.ROOT, {
      isAuthenticated: false,
      isLoading: true,
    });

    expect(router.state.location.pathname).toBe(ROUTES.CHARGES.ROOT);
    expect(html).toMatchSnapshot();
    // Protected content is not rendered while loading
    expect(html).not.toContain('Charges Page');
    expect(router.state.location.pathname).not.toBe(ROUTES.LOGIN);
    await cleanup();
  });
});

describe('PublicOnlyGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects authenticated users away from login page', async () => {
    const { router, cleanup } = await renderPublicPath(ROUTES.LOGIN, {
      isAuthenticated: true,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe(ROUTES.HOME);
    await cleanup();
  });

  it('allows forced reauth login page even when authenticated', async () => {
    const { html, router, cleanup } = await renderPublicPath(`${ROUTES.LOGIN}?reauth=1`, {
      isAuthenticated: true,
      isLoading: false,
    });

    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
    expect(router.state.location.search).toBe('?reauth=1');
    expect(html).toContain('Login Page');
    await cleanup();
  });
});
