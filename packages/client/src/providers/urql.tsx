import { useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  createClient,
  fetchExchange,
  mapExchange,
  Provider,
  type AnyVariables,
  type Operation,
} from 'urql';
import { authExchange } from '@urql/exchange-auth';
import { AuthContext } from './auth-guard.js';

export function UrqlProvider({ children }: { children?: ReactNode }): ReactNode {
  const { authService } = useContext(AuthContext);
  const navigate = useNavigate();
  const loggedIn = authService.isLoggedIn();

  const token = useMemo(() => {
    const token = authService.authToken();
    return token;
  }, [authService]);

  const client = useMemo(() => {
    if (!loggedIn) {
      return null;
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

    return createClient({
      url,
      exchanges: [
        mapExchange({
          onResult(result) {
            const networkError = !!result?.error?.networkError;
            if (networkError) {
              console.error('Network Error:', result.error!.networkError);
              navigate('/network-error');
            }
            const isAuthError =
              result?.error?.graphQLErrors.some(e => e.extensions?.code === 'FORBIDDEN') ||
              result?.error?.response?.status === 401;
            if (isAuthError) {
              navigate('/login', {
                state: { message: 'You are not authorized to access this page' },
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
  }, [loggedIn, navigate, token, authService]);

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
