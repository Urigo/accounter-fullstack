import { useState, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useAcceptInvitation } from '@/hooks/use-accept-invitation.js';
import { ROUTES } from '@/router/routes.js';
import { Button } from '../ui/button.jsx';

export function AcceptInvitationPage(): ReactElement {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const { fetching, error, acceptInvitation } = useAcceptInvitation();
  const [accepted, setAccepted] = useState(false);

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">Invalid invitation link</h1>
          <p className="text-muted-foreground">
            This invitation link is incomplete. Please use the full link from your email.
          </p>
        </div>
      </div>
    );
  }

  // While Auth0 is resolving authentication state, show a loading/skeleton view.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">Loading invitation...</h1>
          <p className="text-muted-foreground">
            Please wait while we check your authentication status.
          </p>
        </div>
      </div>
    );
  }

  // After accepting without being authenticated, prompt them to log in.
  if (accepted && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">Invitation accepted!</h1>
          <p className="text-muted-foreground">
            Your account is now active. Please log in to continue.
          </p>
          <Button
            onClick={() =>
              loginWithRedirect({
                authorizationParams: {
                  audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                  scope: 'openid profile email offline_access',
                  redirect_uri: `${window.location.origin}${ROUTES.AUTH_CALLBACK}`,
                },
                appState: { returnTo: ROUTES.HOME },
              })
            }
          >
            Log In
          </Button>
        </div>
      </div>
    );
  }

  const handleAccept = async () => {
    const success = await acceptInvitation(token);
    if (success?.success) {
      if (isAuthenticated) {
        navigate(ROUTES.HOME, { replace: true });
      } else {
        setAccepted(true);
      }
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">You&apos;ve been invited!</h1>
        <p className="text-muted-foreground">
          Click below to accept the invitation and activate your account.
        </p>
        {error && (
          <p className="text-destructive">
            {error.graphQLErrors?.[0]?.message === 'TOKEN_EXPIRED'
              ? 'This invitation link has expired. Please request a new one.'
              : (error.graphQLErrors?.[0]?.message ?? 'An error occurred')}
          </p>
        )}
        <Button onClick={handleAccept} disabled={fetching}>
          {fetching ? 'Accepting...' : 'Accept Invitation'}
        </Button>
        {!isAuthenticated && (
          <p className="text-xs text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              className="underline"
              onClick={() => {
                const returnTo = ROUTES.ACCEPT_INVITATION(token);
                sessionStorage.setItem('auth:returnTo', returnTo);
                sessionStorage.setItem('auth:invitationReturnTo', returnTo);
                loginWithRedirect({
                  authorizationParams: {
                    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                    scope: 'openid profile email offline_access',
                    redirect_uri: `${window.location.origin}${ROUTES.AUTH_CALLBACK}`,
                  },
                  appState: { returnTo },
                });
              }}
            >
              Log in first
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
