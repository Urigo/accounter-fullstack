import { useEffect, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { ROUTES } from '../../router/routes.js';

export function AuthCallbackPage(): ReactElement {
  const { handleRedirectCallback, isLoading, error } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async (): Promise<void> => {
      try {
        const result = await handleRedirectCallback();
        const returnTo = result?.appState?.returnTo as string | undefined;
        navigate(returnTo || ROUTES.CHARGES.ROOT, { replace: true });
      } catch (callbackError) {
        console.error('Auth callback error:', callbackError);
        navigate(`${ROUTES.LOGIN}?error=auth_failed`, { replace: true });
      }
    };

    if (!isLoading && !error) {
      void handleCallback();
    }
  }, [isLoading, error, handleRedirectCallback, navigate]);

  if (error) {
    return <div>Authentication error: {error.message}</div>;
  }

  return <div>Processing authentication...</div>;
}
