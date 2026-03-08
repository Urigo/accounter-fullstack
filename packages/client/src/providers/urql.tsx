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
import { handleUrqlError } from './urql-error-handler.js';

type AccessTokenProvider = () => Promise<string | null>;

let accessTokenProvider: AccessTokenProvider | null = null;
let bearerToken: string | null = null;

export function setUrqlAccessTokenProvider(provider: AccessTokenProvider | null): void {
  accessTokenProvider = provider;
  if (!provider) {
    bearerToken = null;
  }
}

async function refreshBearerToken(): Promise<void> {
  if (!accessTokenProvider) {
    bearerToken = null;
    return;
  }

  try {
    const accessToken = await accessTokenProvider();
    bearerToken = accessToken ? `Bearer ${accessToken}` : null;
  } catch {
    bearerToken = null;
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
      url = 'http://localhost:4000/graphql';
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
        return {
          willAuthError(): boolean {
            return !bearerToken;
          },
          addAuthToOperation(operation): Operation<void, AnyVariables> {
            if (!bearerToken) {
              return operation;
            }
            return utils.appendHeaders(operation, {
              Authorization: bearerToken,
            });
          },
          didAuthError(error, _operation): boolean {
            return (
              error?.response?.status === 401 ||
              error?.graphQLErrors?.some(
                e => e.extensions?.code === 'FORBIDDEN' || e.extensions?.code === 'UNAUTHENTICATED',
              )
            );
          },
          async refreshAuth(): Promise<void> {
            await refreshBearerToken();
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
}

export function UrqlProvider({ children }: { children?: ReactNode }): ReactNode {
  return <Provider value={getUrqlClient()}>{children}</Provider>;
}
