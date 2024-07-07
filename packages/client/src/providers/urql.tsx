import { ReactNode, useEffect, useMemo } from 'react';
import { AnyVariables, createClient, fetchExchange, mapExchange, Operation, Provider } from 'urql';
import { authExchange } from '@urql/exchange-auth';
import { userService } from '../services/user-service';
import { redirect } from '@tanstack/react-router';

function initializeAuthState(): {
  token: string | null;
} {
  const token = userService.authToken();
  return { token };
}

export function UrqlProvider({ children }: { children?: ReactNode }): ReactNode {
  const { isLoggedIn } = userService;
  const loggedIn = isLoggedIn();

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
            const isAuthError =
              result?.error?.graphQLErrors.some(e => e.extensions?.code === 'FORBIDDEN') ||
              result?.error?.response.status === 401;
            if (isAuthError) {
              redirect({
                to: '/login'
              })
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
  }, [loggedIn]);

  useEffect(() => {
    if (!client) {
      redirect({
        to: '/login'
      });
    }
    return;
  }, [client]);

  return <Provider value={client}>{children}</Provider>;
}
