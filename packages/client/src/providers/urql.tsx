import { ReactNode, useEffect, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnyVariables, createClient, fetchExchange, mapExchange, Operation, Provider } from 'urql';
import { authExchange } from '@urql/exchange-auth';
import { userService } from '../services/user-service';

function initializeAuthState(): {
  token: string | null;
} {
  const token = userService.authToken();
  return { token };
}

export function UrqlProvider({ children }: { children?: ReactNode }): ReactNode {
  const { isLoggedIn } = userService;
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  const client = useMemo(() => {
    if (!loggedIn) {
      return null;
    }

    return createClient({
      url: 'http://localhost:4000/graphql',
      exchanges: [
        mapExchange({
          onResult(result) {
            const isAuthError =
              result?.error?.graphQLErrors.some(e => e.extensions?.code === 'FORBIDDEN') ||
              result?.error?.response.status === 401;
            if (isAuthError) {
              navigate('/login', {
                state: { message: 'You are not authorized to access this page' },
              });
            }
          },
        }),
        authExchange(async utils => {
          const { token } = initializeAuthState();

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
                error.response.status === 401 ||
                error.graphQLErrors.some(e => e.extensions?.code === 'FORBIDDEN')
              );
            },
            async refreshAuth(): Promise<void> {
              userService.logout();
            },
          };
        }),
        fetchExchange,
      ],
    });
  }, [loggedIn, navigate]);

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
