import { useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  createClient,
  fetchExchange,
  mapExchange,
  Provider,
  type AnyVariables,
  type Operation,
} from 'urql';
import { authExchange } from '@urql/exchange-auth';
import { ROUTES } from '../router/routes.js';
import { AuthContext } from './auth-guard.js';

export function UrqlProvider({ children }: { children?: ReactNode }): ReactNode {
  const { authService } = useContext(AuthContext);
  const navigate = useNavigate();

  // Track login state to trigger token updates
  const loggedIn = authService.isLoggedIn();

  const token = useMemo(() => {
    const token = authService.authToken();
    return token;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loggedIn is needed to trigger token refresh on login
  }, [authService, loggedIn]);

  const client = useMemo(() => {
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

    return createClient({
      url,
      exchanges: [
        mapExchange({
          onResult(result) {
            // Handle authentication errors
            const isAuthError =
              result?.error?.graphQLErrors.some(e => e.extensions?.code === 'FORBIDDEN') ||
              result?.error?.response?.status === 401;
            if (isAuthError) {
              navigate(ROUTES.LOGIN, {
                state: { message: 'You are not authorized to access this page' },
              });
              return;
            }

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

              // Skip auth errors (already handled above)
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
            },
          };
        }),
        fetchExchange,
      ],
    });
  }, [navigate, token, authService]);

  useEffect(() => {
    if (!client) {
      navigate('/login');
    }
    return;
  }, [client, navigate]);

  return client ? (
    <Provider value={client}>{children}</Provider>
  ) : (
    <Navigate to="/login" state={{ prevPath: window.location.pathname }} />
  );
}
