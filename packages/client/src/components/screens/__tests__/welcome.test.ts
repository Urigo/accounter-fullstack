// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../../../router/routes.js';
import { WelcomePage } from '../welcome.js';

const { useAuth0Mock, useViewerMock, useLogoutMock, claimInvitationMock, refreshViewerMock } =
  vi.hoisted(() => ({
    useAuth0Mock: vi.fn(),
    useViewerMock: vi.fn(),
    useLogoutMock: vi.fn(),
    claimInvitationMock: vi.fn(),
    refreshViewerMock: vi.fn(),
  }));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

vi.mock('../../../hooks/use-viewer.js', () => ({
  useViewer: useViewerMock,
}));

vi.mock('../../../hooks/use-logout.js', () => ({
  useLogout: useLogoutMock,
}));

vi.mock('../../../hooks/use-claim-invitation.js', () => ({
  useClaimInvitation: () => ({
    fetching: false,
    error: undefined,
    claimInvitation: claimInvitationMock,
  }),
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

async function renderWelcome(
  viewerState: Record<string, unknown>,
  authState = { isAuthenticated: true, isLoading: false },
) {
  useAuth0Mock.mockReturnValue(authState);
  useViewerMock.mockReturnValue({ refreshViewer: refreshViewerMock, ...viewerState });
  useLogoutMock.mockReturnValue(vi.fn());

  const router = createMemoryRouter(
    [
      { path: ROUTES.WELCOME, element: React.createElement(WelcomePage) },
      { path: ROUTES.HOME, element: React.createElement('div', null, 'Home Page') },
      { path: ROUTES.LOGIN, element: React.createElement('div', null, 'Login Page') },
    ],
    { initialEntries: [ROUTES.WELCOME] },
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

  return { html, container, router, cleanup };
}

describe('WelcomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains the invitation-only model when the user has no workspace', async () => {
    const { html, cleanup } = await renderWelcome({
      fetching: false,
      error: undefined,
      viewer: {
        email: 'new@example.com',
        emailVerified: true,
        status: 'NO_WORKSPACE',
        pendingInvitations: [],
      },
    });

    expect(html).toContain('No workspace yet');
    expect(html).toContain('invitation-only');
    await cleanup();
  });

  it('asks an unverified user to verify their email', async () => {
    const { html, cleanup } = await renderWelcome({
      fetching: false,
      error: undefined,
      viewer: {
        email: 'new@example.com',
        emailVerified: false,
        status: 'EMAIL_UNVERIFIED',
        pendingInvitations: [],
      },
    });

    expect(html).toContain('Verify your email');
    await cleanup();
  });

  it('reports an unknown state instead of "no workspace" when the query fails', async () => {
    const { html, cleanup } = await renderWelcome({
      fetching: false,
      error: new Error('network down'),
      viewer: null,
    });

    expect(html).toContain('Could not check your account');
    expect(html).not.toContain('No workspace yet');
    await cleanup();
  });

  it('sends an unauthenticated visitor to login without querying the viewer', async () => {
    // /welcome is a public route, so it can be opened with no session at all.
    const { router, cleanup } = await renderWelcome(
      { fetching: false, error: undefined, viewer: null },
      { isAuthenticated: false, isLoading: false },
    );

    expect(useViewerMock).toHaveBeenCalledWith({ pause: true });
    expect(router.state.location.pathname).toBe(ROUTES.LOGIN);
    await cleanup();
  });

  it('holds the viewer query until Auth0 has resolved', async () => {
    // Asking before the token is attached would answer "no workspace" for a
    // perfectly good account.
    const { cleanup } = await renderWelcome(
      { fetching: false, error: undefined, viewer: null },
      { isAuthenticated: false, isLoading: true },
    );

    expect(useViewerMock).toHaveBeenCalledWith({ pause: true });
    await cleanup();
  });

  it('offers a waiting invitation instead of the dead-end copy', async () => {
    const { html, cleanup } = await renderWelcome({
      fetching: false,
      error: undefined,
      viewer: {
        email: 'new@example.com',
        emailVerified: true,
        status: 'NO_WORKSPACE',
        pendingInvitations: [
          {
            id: 'inv-1',
            businessId: 'biz-1',
            businessName: 'Acme Ltd',
            roleId: 'employee',
            expiresAt: '2030-01-01T00:00:00.000Z',
          },
        ],
      },
    });

    expect(html).toContain("You've been invited");
    expect(html).toContain('Acme Ltd');
    expect(html).toContain('Accept');
    expect(html).not.toContain('invitation-only');
    await cleanup();
  });

  it('claims the invitation and returns to the app', async () => {
    claimInvitationMock.mockResolvedValue({ success: true, businessId: 'biz-1' });

    const { container, router, cleanup } = await renderWelcome({
      fetching: false,
      error: undefined,
      viewer: {
        email: 'new@example.com',
        emailVerified: true,
        status: 'NO_WORKSPACE',
        pendingInvitations: [
          {
            id: 'inv-1',
            businessId: 'biz-1',
            businessName: 'Acme Ltd',
            roleId: 'employee',
            expiresAt: '2030-01-01T00:00:00.000Z',
          },
        ],
      },
    });

    const acceptButton = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Accept',
    );
    await act(async () => {
      acceptButton?.click();
      await Promise.resolve();
    });

    expect(claimInvitationMock).toHaveBeenCalledWith('inv-1');
    // The stale NO_WORKSPACE answer must not outlive the navigation.
    expect(refreshViewerMock).toHaveBeenCalled();
    expect(router.state.location.pathname).toBe(ROUTES.HOME);
    await cleanup();
  });

  it('returns an active viewer to the app', async () => {
    const { router, cleanup } = await renderWelcome({
      fetching: false,
      error: undefined,
      viewer: {
        email: 'member@example.com',
        emailVerified: true,
        status: 'ACTIVE',
        pendingInvitations: [],
      },
    });

    expect(router.state.location.pathname).toBe(ROUTES.HOME);
    await cleanup();
  });
});
