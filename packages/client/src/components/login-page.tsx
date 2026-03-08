import { useEffect, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { ROUTES } from '../router/routes.js';
import { Button } from './ui/button.jsx';

export function LoginPage(): ReactElement {
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();

  const authError =
    new URLSearchParams(location.search).get('error') === 'auth_failed'
      ? 'Authentication failed. Please try again.'
      : null;

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(ROUTES.CHARGES.ROOT, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    // Clean up legacy user session from localStorage
    localStorage.removeItem('user');
  }, []);

  return (
    <div className="w-full flex flex-col justify-center items-center h-screen lg:grid lg:min-h-[200px] lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center">
        <div className="space-y-8 w-[320px]">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Accounter</h1>
            <h2 className="text-3xl font-bold">Sign In</h2>
            <p className="text-balance text-muted-foreground">Use your Auth0 account to continue</p>
            {authError ? <p className="text-sm text-destructive">{authError}</p> : null}
          </div>

          <Button
            onClick={() =>
              loginWithRedirect({
                authorizationParams: {
                  audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                  scope: 'openid profile email',
                  redirect_uri: `${window.location.origin}${ROUTES.AUTH_CALLBACK}`,
                },
                appState: { returnTo: ROUTES.CHARGES.ROOT },
              })
            }
            className="w-full font-semibold"
            disabled={isLoading}
          >
            {isLoading ? 'Preparing sign in...' : 'Continue with Auth0'}
          </Button>
        </div>
      </div>

      <div className="hidden bg-muted lg:block bg-black rounded-tl-3xl rounded-bl-3xl">
        <div className="flex flex-row justify-center items-center h-screen">
          <img
            src="../../icons/guild-logo.svg"
            alt="Guild logo"
            className="w-[100px] h-[100px] object-cover"
          />
        </div>
      </div>
    </div>
  );
}
