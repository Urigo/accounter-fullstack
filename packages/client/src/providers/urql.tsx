import { ReactNode, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { isLoggedIn } = userService;
  const loggedIn = isLoggedIn();

  const client = useMemo(() => {
    if (!loggedIn) {
      return null;
    }

    return createClient({
      url: 'http://localhost:4000/graphql',
      exchanges: [
        mapExchange({
          onError(error, _operation) {
            const isAuthError =
              error.graphQLErrors.some(e => e.extensions?.code === 'FORBIDDEN') ||
              error.response.status === 401;
            if (isAuthError) {
              userService.logout();
            }
          },
          onOperation(operation: Operation) {
            return operation;
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
  }, [loggedIn]);

  useEffect(() => {
    if (!client) {
      navigate('/login');
    }
    return;
  }, [client, navigate]);

  return <Provider value={client ?? {}}>{children}</Provider>;
}
