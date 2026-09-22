import type { GetTokenSilentlyOptions } from '@auth0/auth0-react';
import type { AccessTokenProvider } from '../providers/urql.js';
import { isReauthRequiredAuth0Error } from './auth0-errors.js';

/**
 * The `useAuth0().getAccessTokenSilently` shape this module depends on.
 *
 * Deliberately narrower than the SDK's overload set: the detailed-response
 * overload is never used here, so the provider only has to reason about the
 * `string | undefined` result.
 */
export type GetAccessTokenSilently = (
  options?: GetTokenSilentlyOptions,
) => Promise<string | undefined>;

/**
 * Builds the access-token provider that `setUrqlAccessTokenProvider` registers,
 * translating Auth0 outcomes into the urql client's token resolution.
 */
export function createAuth0AccessTokenProvider(
  getAccessTokenSilently: GetAccessTokenSilently,
  audience: string | undefined,
): AccessTokenProvider {
  return async options => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience,
          // Request API token scopes only; offline_access is requested during interactive login.
          scope: 'openid profile email',
        },
        ...options,
      });

      // auth0-spa-js >= 2.27 resolves to `undefined` once the session-expiry ceiling
      // is reached: it clears the local session, so silent renewal can never succeed.
      // Treat it like the re-auth-required errors below rather than as a failure.
      if (!token) {
        return { status: 'unauthenticated' };
      }

      return { status: 'token', token };
    } catch (error) {
      const auth0Error = error as Error & { error?: string };

      // An expired/invalid/missing refresh token means silent renewal can never succeed —
      // signal "unauthenticated" so the user is re-authenticated instead of seeing a
      // misleading network error. Genuine transient/network failures stay as errors.
      if (isReauthRequiredAuth0Error(auth0Error)) {
        return { status: 'unauthenticated' };
      }

      return { status: 'error', error: auth0Error };
    }
  };
}
