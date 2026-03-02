import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createClient,
  fetchExchange,
  mapExchange,
  Provider,
  type AnyVariables,
  type Operation,
} from 'urql';
import { useAuth0 } from '@auth0/auth0-react';
import { authExchange } from '@urql/exchange-auth';
import { ROUTES } from '../router/routes.js';
import { handleUrqlError } from './urql-error-handler.js';

export function UrqlProvider({ children }: { children?: ReactNode }): ReactNode {
  const { getAccessTokenSilently, isAuthenticated, logout } = useAuth0();
  const [token, setToken] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const refreshToken = async (): Promise<void> => {
      if (!isAuthenticated) {
        setToken(null);
        return;
      }

      try {
        const accessToken = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            scope: 'openid profile email',
          },
        });

        setToken(`Bearer ${accessToken}`);
      } catch (tokenError) {
        console.error('Failed to get Auth0 access token:', tokenError);
        setToken(null);
      }
    };

    void refreshToken();
  }, [isAuthenticated, getAccessTokenSilently]);

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
            const isAuthError =
              result?.error?.graphQLErrors.some(
                e => e.extensions?.code === 'FORBIDDEN' || e.extensions?.code === 'UNAUTHENTICATED',
              ) || result?.error?.response?.status === 401;

            if (isAuthError) {
              void logout({
                logoutParams: {
                  returnTo: `${window.location.origin}${ROUTES.LOGIN}`,
                },
              });
              return;
            }

            handleUrqlError(result);
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
                error?.graphQLErrors?.some(
                  e =>
                    e.extensions?.code === 'FORBIDDEN' || e.extensions?.code === 'UNAUTHENTICATED',
                )
              );
            },
            async refreshAuth(): Promise<void> {
              if (!isAuthenticated) {
                setToken(null);
                navigate(ROUTES.LOGIN, {
                  state: { message: 'You are not authorized to access this page' },
                });
                return;
              }

              try {
                const refreshedToken = await getAccessTokenSilently({
                  authorizationParams: {
                    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                    scope: 'openid profile email',
                  },
                  cacheMode: 'off',
                });

                setToken(`Bearer ${refreshedToken}`);
              } catch (refreshError) {
                console.error('Failed to refresh Auth0 token:', refreshError);
                setToken(null);
                navigate(ROUTES.LOGIN, {
                  state: { message: 'Session expired. Please sign in again.' },
                });
              }
            },
          };
        }),
        fetchExchange,
      ],
    });
  }, [navigate, token, getAccessTokenSilently, isAuthenticated, logout]);

  return <Provider value={client}>{children}</Provider>;
}
