import { createContext, useEffect, useState, type ReactNode } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { NetworkError } from '@/components/screens/network-error.js';
import { LoginPage } from '../components/login-page.js';
import { ROUTES } from '../router/routes.js';
import { UserService } from '../services/user-service.js';

type ContextType = {
  authService: UserService;
  setAuthService: (authService: UserService) => void;
};

export const AuthContext = createContext<ContextType>({
  authService: new UserService(),
  setAuthService: () => void 0,
});

export const AuthGuard = ({ children }: { children?: ReactNode }): ReactNode => {
  const [authService, setAuthService] = useState<UserService>(new UserService());
  const navigate = useNavigate();

  const loggedIn = authService.isLoggedIn();

  useEffect(() => {
    if (!loggedIn) {
      navigate(ROUTES.LOGIN);
    }
  }, [loggedIn, navigate]);

  return (
    <AuthContext.Provider value={{ authService, setAuthService }}>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.NETWORK_ERROR} element={<NetworkError />} />
        <Route path="*" element={children} />
      </Routes>
    </AuthContext.Provider>
  );
};
