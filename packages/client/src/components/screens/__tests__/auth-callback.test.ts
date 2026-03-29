import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCallbackPage } from '../auth-callback.js';

const { useAuth0Mock, loginWithRedirectMock } = vi.hoisted(() => ({
  useAuth0Mock: vi.fn(),
  loginWithRedirectMock: vi.fn(),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: useAuth0Mock,
}));

const { buttonClickMode } = vi.hoisted(() => ({
  buttonClickMode: { clickRetryOnRender: false },
}));

vi.mock('../../ui/button.js', () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<'button'>) => {
    if (buttonClickMode.clickRetryOnRender && children === 'Try Again') {
      onClick?.({} as never);
    }

    return React.createElement('button', props, children);
  },
}));

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buttonClickMode.clickRetryOnRender = false;
    // sessionStorage is not available in Node.js (non-jsdom) environment;
    // stub it so tests that simulate button clicks don't throw
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  function renderWithAuthError(authError: Error & { error?: string }): string {
    useAuth0Mock.mockReturnValue({
      handleRedirectCallback: vi.fn(),
      isLoading: false,
      error: authError,
      isAuthenticated: false,
      loginWithRedirect: loginWithRedirectMock,
    });

    return renderToStaticMarkup(
      React.createElement(MemoryRouter, null, React.createElement(AuthCallbackPage)),
    );
  }

  it('renders mapped error state with retry button', () => {
    const html = renderWithAuthError(Object.assign(new Error('Denied'), { error: 'access_denied' }));

    expect(html).toContain('Login Failed');
    expect(html).toContain('Login was cancelled or permissions were not granted.');
    expect(html).toContain('Try Again');
    expect(html).toContain('Back to Login');
  });

  it('calls loginWithRedirect when retry button is triggered', () => {
    buttonClickMode.clickRetryOnRender = true;

    renderWithAuthError(Object.assign(new Error('Denied'), { error: 'access_denied' }));

    expect(loginWithRedirectMock).toHaveBeenCalledTimes(1);
  });
});
