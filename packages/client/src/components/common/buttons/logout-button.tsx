import { useCallback, useContext, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../../providers/auth-guard.js';
import { Button } from '../../ui/button.js';

export function LogoutButton(): ReactElement {
  const navigate = useNavigate();
  const { authService } = useContext(AuthContext);

  const onLogout = useCallback(() => {
    authService.logout();
    navigate('/login');
  }, [navigate, authService]);

  return (
    <Button variant="ghost" onClick={onLogout}>
      Log out
    </Button>
  );
}
