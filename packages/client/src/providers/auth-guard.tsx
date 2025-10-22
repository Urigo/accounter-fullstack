import { createContext, useMemo, useState, type ReactNode } from 'react';
import { UserService } from '../services/user-service.js';

type ContextType = {
  authService: UserService;
  setAuthService: (authService: UserService) => void;
};

export const AuthContext = createContext<ContextType>({
  authService: new UserService(),
  setAuthService: () => void 0,
});

/**
 * AuthProvider - provides authentication context
 * Auth routing logic is now handled by route loaders
 */
export const AuthProvider = ({ children }: { children?: ReactNode }): ReactNode => {
  // Use lazy initialization to prevent creating new UserService on every render
  const [authService, setAuthService] = useState<UserService>(() => new UserService());

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ authService, setAuthService }), [authService]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

// Keep AuthGuard as alias for backwards compatibility
export const AuthGuard = AuthProvider;
