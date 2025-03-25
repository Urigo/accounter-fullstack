import { createContext, ReactNode, useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { LoginPage } from '../components/login-page.js';
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
      navigate('/login');
    }
  }, [loggedIn, navigate]);

  return (
    <AuthContext.Provider value={{ authService, setAuthService }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={children} />
      </Routes>
    </AuthContext.Provider>
  );
};
