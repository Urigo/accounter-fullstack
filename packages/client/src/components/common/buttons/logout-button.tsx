import { type ReactElement } from 'react';
import { useLogout } from '../../../hooks/use-logout.js';
import { Button } from '../../ui/button.js';

export function LogoutButton(): ReactElement {
  const handleLogout = useLogout();

  return (
    <Button variant="ghost" onClick={handleLogout}>
      Log out
    </Button>
  );
}
