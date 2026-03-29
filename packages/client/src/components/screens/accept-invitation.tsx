import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useAcceptInvitation } from '@/hooks/use-accept-invitation.js';
import { ROUTES } from '@/router/routes.js';
import { Button } from '../ui/button.js';

export function AcceptInvitationPage(): ReactElement {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const { fetching, error, acceptInvitation } = useAcceptInvitation();

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

  // Unauthenticated users must log in first, then return to this tokenized route.
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">You&apos;ve been invited!</h1>
          <p className="text-muted-foreground">
            Please log in or create an account to accept this invitation.
          </p>
          <Button
            onClick={() => {
              const returnTo = ROUTES.ACCEPT_INVITATION(token);
              sessionStorage.setItem('auth:returnTo', returnTo);
              sessionStorage.setItem('auth:invitationReturnTo', returnTo);

              return loginWithRedirect({
                authorizationParams: {
                  audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                  scope: 'openid profile email offline_access',
                  redirect_uri: `${window.location.origin}${ROUTES.AUTH_CALLBACK}`,
                },
                appState: { returnTo },
              });
            }}
          >
            Login / Create Account
          </Button>
        </div>
      </div>
    );
  }

  const handleAccept = async () => {
    const success = await acceptInvitation(token);
    if (success?.success) {
      navigate(ROUTES.HOME, { replace: true });
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Accept Invitation</h1>
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
      </div>
    </div>
  );
}
