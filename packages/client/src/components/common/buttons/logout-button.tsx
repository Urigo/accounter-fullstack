import { ReactElement, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../../../services/user-service.js';
import { Button } from '../../ui/button.js';

export function LogoutButton(): ReactElement {
  const navigate = useNavigate();

  const onLogout = useCallback(() => {
    userService.logout();
    navigate('/login');
  }, [navigate]);

  return (
    <Button variant="ghost" onClick={onLogout}>
      Log out
    </Button>
  );
}
