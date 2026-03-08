import {
  createClient,
  fetchExchange,
  mapExchange,
  type AnyVariables,
  type Client,
  type Operation,
} from 'urql';
import { authExchange } from '@urql/exchange-auth';
import { getStoredAuth0AccessToken } from '../lib/auth0-session.js';
import { handleUrqlError } from './urql-error-handler.js';

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
          addAuthToOperation(operation): Operation<void, AnyVariables> {
            const accessToken = getStoredAuth0AccessToken();
            const token = accessToken ? `Bearer ${accessToken}` : null;
            if (!token) {
              return operation;
            }
            return utils.appendHeaders(operation, {
              Authorization: token,
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
            // Auth0 refresh is handled by the Auth0 React provider in app runtime.
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
}
