import { toast } from 'sonner';
import {
  createClient,
  fetchExchange,
  mapExchange,
  type AnyVariables,
  type Client,
  type Operation,
} from 'urql';
import { authExchange } from '@urql/exchange-auth';
import { UserService } from '../services/user-service.js';

/**
 * Singleton URQL client for use in loaders and server-side operations
 * This is separate from the Provider client to avoid React context dependencies
 */
let globalClient: Client | null = null;

export function getUrqlClient(): Client {
  if (globalClient) {
    return globalClient;
  }

  const authService = new UserService();

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
          // Handle network errors
          if (result.error?.networkError) {
            console.error('Network Error:', result.error.networkError);
            toast.error('Network Error', {
              description: 'Failed to connect to the server. Please check your connection.',
              duration: 5000,
            });
            return;
          }

          // Handle common GraphQL errors with toast notifications
          if (result.error?.graphQLErrors?.length) {
            const graphqlError = result.error.graphQLErrors[0];
            const { message } = graphqlError;
            const code = graphqlError.extensions?.code as string | undefined;

            // Skip auth errors (handled by authExchange)
            if (code === 'FORBIDDEN') {
              return;
            }

            // Show toast for common GraphQL errors
            console.error('GraphQL Error:', graphqlError);
            toast.error('Operation Error', {
              description: message || 'An error occurred while processing your request.',
              duration: 5000,
            });
          }
        },
      }),
      authExchange(async utils => {
        return {
          addAuthToOperation(operation): Operation<void, AnyVariables> {
            const token = authService.authToken();
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
              error?.graphQLErrors?.some(e => e.extensions?.code === 'FORBIDDEN')
            );
          },
          async refreshAuth(): Promise<void> {
            authService.logout();
            // Redirect handled by route loader
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
