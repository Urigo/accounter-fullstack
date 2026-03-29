import { useEffect, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { AUTH0_ERROR_MESSAGES } from '../lib/auth0-errors.js';
import { clearStoredAuth0Session } from '../lib/auth0-session.js';
import { ROUTES } from '../router/routes.js';
import { Button } from './ui/button.js';

export function LoginPage(): ReactElement {
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isReauthFlow = searchParams.get('reauth') === '1';
  const returnTo =
    (location.state as { returnTo?: string } | null)?.returnTo ??
    (isReauthFlow ? sessionStorage.getItem('auth:invitationReturnTo') : null) ??
    ROUTES.HOME;
  const errorParam = searchParams.get('error');

  const authError = errorParam
    ? errorParam === 'auth_failed'
      ? 'Authentication failed. Please try again.'
      : (AUTH0_ERROR_MESSAGES[errorParam] ?? errorParam)
    : isReauthFlow
      ? 'Your session expired. Please sign in again.'
      : null;

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isReauthFlow) {
      navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, isReauthFlow, navigate, returnTo]);

  useEffect(() => {
    // Clean up legacy user session from localStorage
    localStorage.removeItem('user');

    if (isReauthFlow) {
      // Recover from stale/rotated refresh tokens that can keep silent renewal failing.
      clearStoredAuth0Session();
    }
  }, [isReauthFlow]);

  return (
    <div className="w-full flex flex-col justify-center items-center h-screen lg:grid lg:min-h-[200px] lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center">
        <div className="space-y-8 w-[320px]">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Accounter</h1>
            <h2 className="text-3xl font-bold">Sign In</h2>
            <p className="text-balance text-muted-foreground">Use your Auth0 account to continue</p>
            {authError ? <p className="text-sm text-destructive">{authError}</p> : null}
          </div>

          <Button
            onClick={() => {
              // Avoid overwriting an existing returnTo set earlier in the reauth flow.
              if (!isReauthFlow || !sessionStorage.getItem('auth:returnTo')) {
                sessionStorage.setItem('auth:returnTo', returnTo);
              }
              return loginWithRedirect({
                authorizationParams: {
                  audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                  scope: 'openid profile email offline_access',
                  ...(isReauthFlow ? { prompt: 'login' } : {}),
                  redirect_uri: `${window.location.origin}${ROUTES.AUTH_CALLBACK}`,
                },
                appState: { returnTo },
              });
            }}
            className="w-full font-semibold"
            disabled={isLoading}
          >
            {isLoading ? 'Preparing sign in...' : 'Continue with Auth0'}
          </Button>
        </div>
      </div>

      <div className="hidden bg-muted lg:block bg-black rounded-tl-3xl rounded-bl-3xl">
        <div className="flex flex-row justify-center items-center h-screen">
          <img
            src="../../icons/guild-logo.svg"
            alt="Guild logo"
            className="w-[100px] h-[100px] object-cover"
          />
        </div>
      </div>
    </div>
  );
}
