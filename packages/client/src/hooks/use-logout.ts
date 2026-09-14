import { useAuth0 } from '@auth0/auth0-react';
import { resetUrqlClientAndNotify } from '../providers/urql.js';
import { ROUTES } from '../router/routes.js';

export function useLogout(): () => Promise<void> {
  const { logout } = useAuth0();

  return async () => {
    sessionStorage.clear();

    // Before `logout()`, not after: it navigates away, so anything queued
    // behind it may never run. Dropping the client here discards the bearer
    // token and hands the Provider a fresh one, so nothing a later session
    // renders can be served from the previous user's state.
    resetUrqlClientAndNotify();

    await logout({
      logoutParams: {
        returnTo: `${window.location.origin}${ROUTES.LOGIN}`,
      },
    });
  };
}
