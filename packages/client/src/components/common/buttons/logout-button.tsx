import { type ReactElement } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { ROUTES } from '../../../router/routes.js';
import { Button } from '../../ui/button.js';

export function LogoutButton(): ReactElement {
  const { logout } = useAuth0();

  const handleLogout = async (): Promise<void> => {
    await logout({
      logoutParams: {
        returnTo: `${window.location.origin}${ROUTES.LOGIN}`,
      },
    });
  };

  return (
    <Button variant="ghost" onClick={handleLogout}>
      Log out
    </Button>
  );
}
