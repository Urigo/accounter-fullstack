import { useContext, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../../providers/auth-guard.js';
import { ROUTES } from '../../../router/routes.js';
import { Button } from '../../ui/button.js';

export function LogoutButton(): ReactElement {
  const navigate = useNavigate();
  const { authService } = useContext(AuthContext);

  const handleLogout = async (): Promise<void> => {
    await authService.logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <Button variant="ghost" onClick={handleLogout}>
      Log out
    </Button>
  );
}
