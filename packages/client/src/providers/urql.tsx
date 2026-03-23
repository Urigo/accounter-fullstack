import type { ReactNode } from 'react';
import {
  createClient,
  fetchExchange,
  mapExchange,
  Provider,
  type AnyVariables,
  type Client,
  type Operation,
} from 'urql';
import { authExchange } from '@urql/exchange-auth';
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

let accessTokenProvider: AccessTokenProvider | null = null;
let bearerToken: string | null = null;
let loginRedirectInProgress = false;

export function setUrqlAccessTokenProvider(provider: AccessTokenProvider | null): void {
  accessTokenProvider = provider;
  if (!provider) {
    bearerToken = null;
    loginRedirectInProgress = false;
  }
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
 * Singleton URQL client for use in loaders and server-side operations
 * This is separate from the Provider client to avoid React context dependencies
 */
let globalClient: Client | null = null;

export function getUrqlClient(): Client {
  if (globalClient) {
    return globalClient;
  }

  let url: string;
  switch (import.meta.env.MODE) {
    case 'production': {
      url = 'https://accounter.onrender.com/graphql';
      break;
    }
    case 'staging': {
      url = 'https://accounter-staging.onrender.com/graphql';
      break;
    }
    default: {
      url = import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:4000/graphql';
      break;
    }
  }

  globalClient = createClient({
    url,
    exchanges: [
      mapExchange({
        onResult(result) {
          handleUrqlError(result);
        },
      }),
      authExchange(async utils => {
        const initialToken = await getAccessToken();
        bearerToken = initialToken.status === 'token' ? `Bearer ${initialToken.token}` : null;

        return {
          willAuthError(): boolean {
            // Avoid eager refresh loops; refresh only after explicit UNAUTHENTICATED responses.
            return false;
          },
          addAuthToOperation(operation): Operation<void, AnyVariables> {
            if (!bearerToken) {
              return operation;
            }
            return utils.appendHeaders(operation, {
              Authorization: bearerToken,
            });
          },
          didAuthError(error): boolean {
            return (
              error.graphQLErrors?.some(e => e.extensions?.code === 'UNAUTHENTICATED') ?? false
            );
          },
          async refreshAuth(): Promise<void> {
            const refreshedToken = await getAccessToken({ cacheMode: 'off' });

            if (refreshedToken.status === 'error') {
              // Preserve current bearer token on transient provider failures.
              throw toError(refreshedToken.error);
            }

            if (refreshedToken.status === 'unauthenticated') {
              bearerToken = null;
              redirectToLogin();
              return;
            }

            loginRedirectInProgress = false;
            bearerToken = `Bearer ${refreshedToken.token}`;
          },
        };
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

export function UrqlProvider({ children }: { children?: ReactNode }): ReactNode {
  return <Provider value={getUrqlClient()}>{children}</Provider>;
}
