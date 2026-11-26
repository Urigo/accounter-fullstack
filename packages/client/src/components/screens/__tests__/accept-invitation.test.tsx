// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptInvitationPage } from '../accept-invitation.js';
import { ROUTES } from '../../../router/routes.js';

const {
  useAuth0Mock,
  useAcceptInvitationMock,
  loginWithRedirectMock,
  acceptInvitationMock,
  logoutMock,
  navigateMock,
  hookState,
  routeToken,
} = vi.hoisted(() => ({
  useAuth0Mock: vi.fn(),
  useAcceptInvitationMock: vi.fn(),
  loginWithRedirectMock: vi.fn(),
  acceptInvitationMock: vi.fn(),
  logoutMock: vi.fn(),
  navigateMock: vi.fn(),
  hookState: {
    fetching: false,
    error: undefined as MutationError | undefined,
  },
  routeToken: { value: 'invite-token-123' },
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

vi.mock('../../../hooks/use-accept-invitation.js', () => ({
  useAcceptInvitation: useAcceptInvitationMock,
}));

vi.mock('../../../hooks/use-logout.js', () => ({
  useLogout: () => logoutMock,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ token: routeToken.value }),
  };
});

vi.mock('../../ui/button.js', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) =>
    React.createElement('button', props, children),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type MutationError = {
  graphQLErrors?: Array<{ message?: string; extensions?: Record<string, unknown> }>;
};

async function renderScreen(): Promise<{ container: HTMLDivElement; cleanup: () => Promise<void> }> {
  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(AcceptInvitationPage));
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

function mockAuthState({
  isAuthenticated,
  isLoading,
}: {
  isAuthenticated: boolean;
  isLoading?: boolean;
}) {
  useAuth0Mock.mockReturnValue({
    isAuthenticated,
    isLoading: isLoading ?? false,
    loginWithRedirect: loginWithRedirectMock,
  });
}

function mockMutationState({
  fetching = false,
  error,
}: {
  fetching?: boolean;
  error?: MutationError;
}) {
  hookState.fetching = fetching;
  hookState.error = error;
}

describe('AcceptInvitationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeToken.value = 'invite-token-123';
    acceptInvitationMock.mockResolvedValue({
      success: true,
      businessId: 'business-1',
      roleId: 'employee',
    });
    mockMutationState({});
    useAcceptInvitationMock.mockImplementation(() => ({
      fetching: hookState.fetching,
      error: hookState.error,
      acceptInvitation: acceptInvitationMock,
    }));
  });

  it('shows login prompt for unauthenticated users and hides accept action', async () => {
    mockAuthState({ isAuthenticated: false });

    const { container, cleanup } = await renderScreen();

    expect(container.textContent).toContain("You've been invited!");
    expect(container.textContent).toContain('Login / Create Account');
    expect(container.textContent).not.toContain('Accept Invitation');

    await cleanup();
  });

  it('preserves token in Auth0 login appState.returnTo', async () => {
    mockAuthState({ isAuthenticated: false });

    const { container, cleanup } = await renderScreen();

    const loginButton = Array.from(container.querySelectorAll('button')).find(button =>
      /login\s*\/\s*create account/i.test(button.textContent ?? ''),
    );
    expect(loginButton).toBeTruthy();

    await act(async () => {
      loginButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(loginWithRedirectMock).toHaveBeenCalledWith({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: 'openid profile email offline_access',
        redirect_uri: `${window.location.origin}${ROUTES.AUTH_CALLBACK}`,
      },
      appState: { returnTo: ROUTES.ACCEPT_INVITATION('invite-token-123') },
    });

    await cleanup();
  });

  it('shows accept button for authenticated users', async () => {
    mockAuthState({ isAuthenticated: true });

    const { container, cleanup } = await renderScreen();

    expect(container.textContent).toContain('Accept Invitation');

    await cleanup();
  });

  it('redirects to home after successful invitation acceptance', async () => {
    mockAuthState({ isAuthenticated: true });
    acceptInvitationMock.mockResolvedValue({
      success: true,
      businessId: 'business-1',
      roleId: 'employee',
    });

    const { container, cleanup } = await renderScreen();

    const acceptButton = Array.from(container.querySelectorAll('button')).find(button =>
      /accept invitation/i.test(button.textContent ?? ''),
    );
    expect(acceptButton).toBeTruthy();

    await act(async () => {
      acceptButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(acceptInvitationMock).toHaveBeenCalledWith('invite-token-123');
    expect(navigateMock).toHaveBeenCalledWith(ROUTES.APP_HOME, { replace: true });

    await cleanup();
  });

  it('shows mutation error message when acceptance fails', async () => {
    mockAuthState({ isAuthenticated: true });
    mockMutationState({
      error: { graphQLErrors: [{ message: 'Invitation could not be accepted' }] },
    });

    const { container, cleanup } = await renderScreen();

    expect(container.textContent).toContain('Invitation could not be accepted');

    await cleanup();
  });

  it('falls back to a message for the error code when the server sends none', async () => {
    mockAuthState({ isAuthenticated: true });
    mockMutationState({
      error: { graphQLErrors: [{ message: '', extensions: { code: 'TOKEN_EXPIRED' } }] },
    });

    const { container, cleanup } = await renderScreen();

    expect(container.textContent).toContain('This invitation link has expired');
    expect(container.textContent).not.toContain('Sign out');

    await cleanup();
  });

  it('names both addresses on an email mismatch and offers to sign out', async () => {
    mockAuthState({ isAuthenticated: true });
    mockMutationState({
      error: {
        graphQLErrors: [
          {
            message:
              'This invitation was sent to owner@example.com, but you are signed in as alias@example.com.',
            extensions: { code: 'INVITATION_EMAIL_MISMATCH' },
          },
        ],
      },
    });

    const { container, cleanup } = await renderScreen();

    expect(container.textContent).toContain('owner@example.com');
    expect(container.textContent).toContain('alias@example.com');
    const signOut = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Sign out',
    );
    expect(signOut).toBeTruthy();

    await act(async () => {
      signOut?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(logoutMock).toHaveBeenCalledOnce();

    await cleanup();
  });

  it('offers to sign out when the signed-in email is not verified', async () => {
    mockAuthState({ isAuthenticated: true });
    mockMutationState({
      error: {
        graphQLErrors: [
          { message: 'Your email is not verified', extensions: { code: 'EMAIL_NOT_VERIFIED' } },
        ],
      },
    });

    const { container, cleanup } = await renderScreen();

    expect(container.textContent).toContain('Your email is not verified');
    expect(container.textContent).toContain('Sign out');

    await cleanup();
  });
});
