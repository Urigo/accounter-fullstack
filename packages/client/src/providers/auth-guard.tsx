import { ReactNode, useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { LoginPage } from '../components/login-page.js';
import { userService } from '../services/user-service.js';

export const AuthGuard = ({ children }: { children?: ReactNode }): ReactNode => {
  const { isLoggedIn } = userService;
  const navigate = useNavigate();

  const loggedIn = isLoggedIn();

  useEffect(() => {
    if (!loggedIn) {
      navigate('/login');
    }
  }, [loggedIn, navigate]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={children} />
    </Routes>
  );
};
