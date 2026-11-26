import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useAcceptInvitation } from '@/hooks/use-accept-invitation.js';
import { useLogout } from '@/hooks/use-logout.js';
import { ROUTES } from '@/router/routes.js';
import { Button } from '../ui/button.js';

type AcceptInvitationError = {
  graphQLErrors?: Array<{ message?: string; extensions?: Record<string, unknown> }>;
};

/**
 * What to tell the invitee about a failed acceptance. The server's message already says which case
 * it is (and, for a wrong account, names both addresses), so it is shown as is; the fallbacks only
 * cover an error that carries no message.
 */
export function describeAcceptInvitationError(error: AcceptInvitationError): {
  code: string | null;
  message: string;
} {
  const graphQLError = error.graphQLErrors?.[0];
  const code =
    typeof graphQLError?.extensions?.code === 'string' ? graphQLError.extensions.code : null;
  const fallback: Record<string, string> = {
    TOKEN_EXPIRED: 'This invitation link has expired. Please request a new one.',
    TOKEN_ALREADY_USED: 'This invitation has already been used.',
    INVITATION_EMAIL_MISMATCH:
      'You are signed in with a different email address than the one this invitation was sent to.',
    EMAIL_NOT_VERIFIED: 'Your sign-in email address is not verified.',
    TOKEN_INVALID: 'This invitation link is not valid. Check that you used the full link.',
  };
  return {
    code,
    message: graphQLError?.message || (code && fallback[code]) || 'An error occurred',
  };
}

export function AcceptInvitationPage(): ReactElement {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const { fetching, error, acceptInvitation } = useAcceptInvitation();
  const handleLogout = useLogout();

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

  const describedError = error ? describeAcceptInvitationError(error) : null;
  // Signing in again is the fix for both: the right address, or one whose email is verified.
  const canSwitchAccount =
    describedError?.code === 'INVITATION_EMAIL_MISMATCH' ||
    describedError?.code === 'EMAIL_NOT_VERIFIED';

  const handleAccept = async () => {
    const success = await acceptInvitation(token);
    if (success?.success) {
      navigate(ROUTES.APP_HOME, { replace: true });
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Accept Invitation</h1>
        {describedError && (
          <p className="text-destructive" role="alert">
            {describedError.message}
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={handleAccept} disabled={fetching}>
            {fetching ? 'Accepting...' : 'Accept Invitation'}
          </Button>
          {canSwitchAccount && (
            <Button variant="outline" onClick={handleLogout}>
              Sign out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
