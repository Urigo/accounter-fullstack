import { useEffect, useState, type ReactNode } from 'react';
import {
  createClient,
  fetchExchange,
  mapExchange,
  Provider,
  type AnyVariables,
  type Client,
  type Operation,
  type OperationContext,
} from 'urql';
import { devtoolsExchange } from '@urql/devtools';
import { authExchange } from '@urql/exchange-auth';
import { retryExchange } from '@urql/exchange-retry';
import { requestInteractiveReauth } from '../lib/reauth-coordinator.js';
import { ROUTES } from '../router/routes.js';
import { handleUrqlError } from './urql-error-handler.js';

type TokenCacheMode = 'on' | 'off';

type AccessTokenResolution =
  | {
      status: 'token';
      token: string;
    }
  | {
      status: 'unauthenticated';
    }
  | {
      status: 'error';
      error: unknown;
    };

type AccessTokenProviderResult = string | null | AccessTokenResolution;

type AccessTokenProvider = (options?: {
  cacheMode?: TokenCacheMode;
}) => Promise<AccessTokenProviderResult>;

const BUSINESS_SCOPE_LS_KEY = 'urql:businessScope';

/** Operation-context key marking a request as exempt from `x-business-scope`. */
export const SKIP_BUSINESS_SCOPE = 'skipBusinessScope';

/**
 * Sends one operation without the `x-business-scope` header. Pass as
 * `useQuery({ context: UNSCOPED_OPERATION_CONTEXT })`.
 *
 * Reserved for the query that *discovers* the scope: narrowing that one by the
 * scope is circular, since its result is the list a user needs in order to
 * leave a narrow scope. The MCP connector documents the same rule for its
 * membership bootstrap — see packages/mcp-server/src/upstream/memberships.ts.
 *
 * A frozen module constant, not an inline object: urql re-executes an operation
 * whenever its context identity changes, so a per-render literal would loop.
 */
export const UNSCOPED_OPERATION_CONTEXT: Partial<OperationContext> = Object.freeze({
  [SKIP_BUSINESS_SCOPE]: true,
});

let accessTokenProvider: AccessTokenProvider | null = null;
let bearerToken: string | null = null;
let loginRedirectInProgress = false;
let businessScope: string | null = (() => {
  try {
    return localStorage.getItem(BUSINESS_SCOPE_LS_KEY);
  } catch {
    return null;
  }
})();
let onClientReset: ((client: Client) => void) | null = null;

export function setUrqlAccessTokenProvider(provider: AccessTokenProvider | null): void {
  accessTokenProvider = provider;
  if (!provider) {
    bearerToken = null;
    loginRedirectInProgress = false;
  }
}

export function getBusinessScopeIds(): string[] {
  if (!businessScope) return [];
  return businessScope.split(',');
}

export function setBusinessScope(ids: string[]): void {
  businessScope = ids.length > 0 ? ids.join(',') : null;
  try {
    if (businessScope) {
      localStorage.setItem(BUSINESS_SCOPE_LS_KEY, businessScope);
    } else {
      localStorage.removeItem(BUSINESS_SCOPE_LS_KEY);
    }
  } catch {
    // ignore
  }
  resetUrqlClientAndNotify();
}

/**
 * The `x-business-scope` header for an operation, or nothing when no scope is
 * set or the operation opted out. One helper for both auth branches so they
 * cannot drift apart.
 */
function businessScopeHeader(operation: Operation<unknown, AnyVariables>): Record<string, string> {
  if (!businessScope) {
    return {};
  }
  if ((operation.context as Record<string, unknown> | undefined)?.[SKIP_BUSINESS_SCOPE] === true) {
    return {};
  }
  return { 'x-business-scope': businessScope };
}

function normalizeAccessTokenResult(result: AccessTokenProviderResult): AccessTokenResolution {
  if (typeof result === 'string') {
    return { status: 'token', token: result };
  }

  if (!result) {
    return { status: 'unauthenticated' };
  }

  if (result.status === 'token') {
    return { status: 'token', token: result.token };
  }

  if (result.status === 'unauthenticated') {
    return { status: 'unauthenticated' };
  }

  return { status: 'error', error: result.error };
}

async function getAccessToken(options?: {
  cacheMode?: TokenCacheMode;
}): Promise<AccessTokenResolution> {
  if (!accessTokenProvider) {
    return { status: 'unauthenticated' };
  }

  try {
    const result = await accessTokenProvider(options);
    return normalizeAccessTokenResult(result);
  } catch (error) {
    return { status: 'error', error };
  }
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error('Failed to refresh access token');
}

function redirectToLogin(): void {
  if (loginRedirectInProgress) {
    return;
  }

  if (typeof window !== 'undefined' && window.location) {
    if (
      window.location.pathname === ROUTES.LOGIN ||
      window.location.pathname === ROUTES.AUTH_CALLBACK
    ) {
      return;
    }

    try {
      if (window.sessionStorage) {
        const { pathname, search, hash } = window.location;
        const returnTo = `${pathname}${search}${hash}`;
        window.sessionStorage.setItem('auth:returnTo', returnTo);
      }
    } catch {
      // Ignore storage errors and continue with redirect
    }

    loginRedirectInProgress = true;
    window.location.href = `${ROUTES.LOGIN}?reauth=1`;
    return;
  }

  if (typeof globalThis !== 'undefined' && 'location' in globalThis && globalThis.location) {
    if (
      globalThis.location.pathname === ROUTES.LOGIN ||
      globalThis.location.pathname === ROUTES.AUTH_CALLBACK
    ) {
      return;
    }

    loginRedirectInProgress = true;
    globalThis.location.href = `${ROUTES.LOGIN}?reauth=1`;
  }
}

/**
 * The GraphQL endpoint for this build.
 *
 * `VITE_GRAPHQL_URL` wins when set, which is what makes preview deploys, branch
 * environments and a per-developer backend possible. It is checked for a
 * non-empty value rather than merely being defined: `vite.config.ts` supplies it
 * through `define`, which substitutes an empty string when the underlying
 * `GRAPHQL_URL` is unset rather than leaving the key absent.
 *
 * Without it, the per-`MODE` defaults below apply, unchanged.
 */
function resolveGraphQLUrl(): string {
  const configured = import.meta.env.VITE_GRAPHQL_URL?.trim();
  if (configured) {
    return configured;
  }

  switch (import.meta.env.MODE) {
    case 'production':
      return 'https://accounter.onrender.com/graphql';
    case 'staging':
      return 'https://accounter-staging.onrender.com/graphql';
    default:
      return 'http://localhost:4000/graphql';
  }
}

/**
 * Singleton URQL client for use in loaders and server-side operations
 * This is separate from the Provider client to avoid React context dependencies
 */
let globalClient: Client | null = null;

export function getUrqlClient(): Client {
  if (globalClient) {
    return globalClient;
  }

  const isDevAuthEnabled = import.meta.env.VITE_DEV_AUTH === '1';
  const devAuthUserId = import.meta.env.VITE_DEV_AUTH_USER_ID?.trim() ?? '';

  const url = resolveGraphQLUrl();

  globalClient = createClient({
    url,
    exchanges: [
      // Dev only, and first so it observes every operation and result. Tree-shaken
      // from production builds by the constant condition.
      ...(import.meta.env.DEV ? [devtoolsExchange] : []),
      mapExchange({
        onResult(result) {
          handleUrqlError(result);
        },
      }),
      // `cacheExchange` belongs here, between the error handler and auth, when
      // normalized caching lands. Nothing occupies the slot today: passing an
      // explicit `exchanges` array means urql installs no cache of its own.

      authExchange(async utils => {
        if (!isDevAuthEnabled) {
          const initialToken = await getAccessToken();
          bearerToken = initialToken.status === 'token' ? `Bearer ${initialToken.token}` : null;
        }

        return {
          willAuthError(): boolean {
            // Avoid eager refresh loops; refresh only after explicit UNAUTHENTICATED responses.
            return false;
          },
          addAuthToOperation(operation): Operation<void, AnyVariables> {
            if (isDevAuthEnabled) {
              if (!devAuthUserId) {
                console.warn(
                  'VITE_DEV_AUTH is enabled but VITE_DEV_AUTH_USER_ID is not set. Dev auth header will be omitted.',
                );
                return operation;
              }

              const devHeaders: Record<string, string> = {
                'X-Dev-Auth': devAuthUserId,
                ...businessScopeHeader(operation),
              };
              return utils.appendHeaders(operation, devHeaders);
            }

            if (!bearerToken) {
              return operation;
            }

            const headers: Record<string, string> = {
              Authorization: bearerToken,
              ...businessScopeHeader(operation),
            };
            return utils.appendHeaders(operation, headers);
          },
          didAuthError(error): boolean {
            return (
              error.graphQLErrors?.some(e => e.extensions?.code === 'UNAUTHENTICATED') ?? false
            );
          },
          async refreshAuth(): Promise<void> {
            if (isDevAuthEnabled) {
              return;
            }

            const refreshedToken = await getAccessToken({ cacheMode: 'off' });

            if (refreshedToken.status === 'error') {
              // Preserve current bearer token on transient provider failures.
              throw toError(refreshedToken.error);
            }

            if (refreshedToken.status === 'unauthenticated') {
              bearerToken = null;

              // Offer in-place re-authentication (modal + Auth0 popup) so queued operations
              // can resume without losing page state. Falls back to a full-page redirect.
              const outcome = await requestInteractiveReauth();
              if (outcome === 'authenticated') {
                const fresh = await getAccessToken({ cacheMode: 'off' });
                if (fresh.status === 'token') {
                  loginRedirectInProgress = false;
                  bearerToken = `Bearer ${fresh.token}`;
                  return;
                }
              }

              redirectToLogin();
              return;
            }

            loginRedirectInProgress = false;
            bearerToken = `Bearer ${refreshedToken.token}`;
          },
        };
      }),
      // After `authExchange`, deliberately: auth then sees a single settled result
      // rather than every retry attempt, so a retry can never drive
      // `didAuthError`/`refreshAuth`. Mutations are excluded by default and stay
      // that way — none of ours are idempotent.
      retryExchange({
        retryIf: error => !!error.networkError,
      }),
      fetchExchange,
    ],
  });

  return globalClient;
}

/**
 * Reset the global client (useful for tests or logout)
 */
export function resetUrqlClient(): void {
  globalClient = null;
  bearerToken = null;
  loginRedirectInProgress = false;
}

/**
 * Discards the client and hands the Provider a fresh one.
 *
 * `resetUrqlClient` alone only clears the singleton, so anything already
 * holding the old `Client` — every mounted `useQuery`, via the Provider — keeps
 * using it, along with its bearer token and any cache an exchange is holding.
 * Both callers need the swap as well, so they share this rather than each
 * remembering to make the second call.
 */
export function resetUrqlClientAndNotify(): void {
  resetUrqlClient();
  onClientReset?.(getUrqlClient());
}

export function UrqlProvider({ children }: { children?: ReactNode }): ReactNode {
  const [client, setClient] = useState(getUrqlClient);

  useEffect(() => {
    onClientReset = setClient;
    return () => {
      if (onClientReset === setClient) onClientReset = null;
    };
  }, []);

  return <Provider value={client}>{children}</Provider>;
}
