import { ReactElement, useCallback } from 'react';
import { userService } from '../../../services/user-service.js';
import { Button } from '../../ui/button.js';
import { useNavigate } from '@tanstack/react-router';

export function LogoutButton(): ReactElement {
  const navigate = useNavigate();

  const onLogout = useCallback(() => {
    userService.logout();
    navigate({
      to: '/login',
    });
  }, [navigate]);

  return (
    <Button variant="ghost" onClick={onLogout}>
      Log out
    </Button>
  );
}
