import { useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { ROUTES } from '../router/routes.js';

/** Scopes the interactive login must request; `offline_access` buys silent renewal later. */
const LOGIN_SCOPE = 'openid profile email offline_access';

type LoginOptions = {
  /** Where to land once the callback resolves. Defaults to the app's first screen. */
  returnTo?: string;
  /**
   * Forces Auth0 to re-prompt even when it still reports a browser session, and
   * keeps any `returnTo` a previous step already stored.
   */
  isReauth?: boolean;
};

/**
 * Sends the browser to Auth0 Universal Login.
 *
 * Shared so that every entry point — the landing page's Log in button, the
 * login screen, a session that expired mid-use — asks for the same audience,
 * scopes and callback URL. Getting one of those wrong is the kind of bug that
 * only shows up as a silent-renewal failure days later.
 */
export function useLogin(): (options?: LoginOptions) => Promise<void> {
  const { loginWithRedirect } = useAuth0();

  return useCallback(
    ({ returnTo = ROUTES.APP_HOME, isReauth = false }: LoginOptions = {}) => {
      // Do not overwrite a returnTo an earlier step in the reauth flow stored.
      if (!isReauth || !sessionStorage.getItem('auth:returnTo')) {
        sessionStorage.setItem('auth:returnTo', returnTo);
      }

      return loginWithRedirect({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          scope: LOGIN_SCOPE,
          ...(isReauth ? { prompt: 'login' } : {}),
          redirect_uri: `${window.location.origin}${ROUTES.AUTH_CALLBACK}`,
        },
        appState: { returnTo },
      });
    },
    [loginWithRedirect],
  );
}
