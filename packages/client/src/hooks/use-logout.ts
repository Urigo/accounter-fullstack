import { useClient } from 'urql';
import { useAuth0 } from '@auth0/auth0-react';
import { ROUTES } from '../router/routes.js';

export function useLogout(): () => Promise<void> {
  const { logout } = useAuth0();
  const urqlClient = useClient();

  return async () => {
    sessionStorage.clear();

    urqlClient.resetStore?.();

    await logout({
      logoutParams: {
        returnTo: `${window.location.origin}${ROUTES.LOGIN}`,
      },
    });
  };
}
