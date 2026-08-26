// @vitest-environment happy-dom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogin } from '../use-login.js';
import { ROUTES } from '../../router/routes.js';

const { useAuth0Mock, loginWithRedirectMock } = vi.hoisted(() => ({
  useAuth0Mock: vi.fn(),
  loginWithRedirectMock: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type HarnessOptions = Parameters<ReturnType<typeof useLogin>>[0];

async function clickLogin(options?: HarnessOptions) {
  function LoginHarness(): React.ReactElement {
    const login = useLogin();

    return React.createElement('button', { onClick: () => void login(options) }, 'Log in');
  }

  const container = document.createElement('div');
  document.body.append(container);

  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(LoginHarness));
    await Promise.resolve();
  });

  await act(async () => {
    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });

  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    container.remove();
  };

  return { cleanup };
}

describe('useLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    loginWithRedirectMock.mockResolvedValue(undefined);
    useAuth0Mock.mockReturnValue({ loginWithRedirect: loginWithRedirectMock });
  });

  it('sends the browser to Auth0 aimed at the app by default', async () => {
    const { cleanup } = await clickLogin();

    expect(loginWithRedirectMock).toHaveBeenCalledTimes(1);
    const [call] = loginWithRedirectMock.mock.calls[0];
    expect(call.appState).toEqual({ returnTo: ROUTES.APP_HOME });
    expect(call.authorizationParams.redirect_uri).toBe(
      `${window.location.origin}${ROUTES.AUTH_CALLBACK}`,
    );
    expect(call.authorizationParams.scope).toBe('openid profile email offline_access');
    // Not a re-prompt: an existing browser session should be reused silently.
    expect(call.authorizationParams.prompt).toBeUndefined();
    expect(sessionStorage.getItem('auth:returnTo')).toBe(ROUTES.APP_HOME);

    await cleanup();
  });

  it('honours an explicit returnTo', async () => {
    const { cleanup } = await clickLogin({ returnTo: ROUTES.REPORTS.VAT_MONTHLY });

    const [call] = loginWithRedirectMock.mock.calls[0];
    expect(call.appState).toEqual({ returnTo: ROUTES.REPORTS.VAT_MONTHLY });
    expect(sessionStorage.getItem('auth:returnTo')).toBe(ROUTES.REPORTS.VAT_MONTHLY);

    await cleanup();
  });

  it('forces a re-prompt on reauth', async () => {
    const { cleanup } = await clickLogin({ isReauth: true });

    const [call] = loginWithRedirectMock.mock.calls[0];
    expect(call.authorizationParams.prompt).toBe('login');

    await cleanup();
  });

  it('keeps a returnTo an earlier reauth step already stored', async () => {
    sessionStorage.setItem('auth:returnTo', ROUTES.DOCUMENTS.ALL);

    const { cleanup } = await clickLogin({ returnTo: ROUTES.APP_HOME, isReauth: true });

    expect(sessionStorage.getItem('auth:returnTo')).toBe(ROUTES.DOCUMENTS.ALL);

    await cleanup();
  });
});
