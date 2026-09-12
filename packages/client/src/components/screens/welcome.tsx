import { useEffect, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useClaimInvitation } from '../../hooks/use-claim-invitation.js';
import { useLogout } from '../../hooks/use-logout.js';
import { useViewer } from '../../hooks/use-viewer.js';
import { ROUTES } from '../../router/routes.js';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert.js';
import { Button } from '../ui/button.js';

/**
 * Terminal screen for an authenticated identity that cannot use the app yet.
 *
 * Accounter is invitation-only, so reaching this screen is expected for anyone
 * who signed up directly, whose invitation expired before they accepted, or who
 * was removed from their last business. It replaces what used to be an empty
 * dashboard buried under failing queries.
 *
 * When an invitation is waiting for the caller's verified email, this is also
 * where they claim it — the emailed link is no longer the only way in.
 */
export function WelcomePage(): ReactElement {
  const { isAuthenticated, isLoading } = useAuth0();
  // This route is public, so it can be opened without a session. Waiting for
  // Auth0 keeps an unauthenticated visitor from spending a request to learn
  // nothing, and keeps an authenticated one from asking before their token is
  // attached — which would answer "no workspace" for a perfectly good account.
  const { fetching, error, viewer, refreshViewer } = useViewer({
    pause: isLoading || !isAuthenticated,
  });
  const { fetching: claiming, claimInvitation } = useClaimInvitation();
  const handleLogout = useLogout();
  const navigate = useNavigate();

  // Provisioning can complete out-of-band (an admin adds the membership), so
  // send an already-active viewer back to the app rather than stranding them.
  useEffect(() => {
    if (viewer?.status === 'ACTIVE') {
      navigate(ROUTES.APP_HOME, { replace: true });
    }
  }, [viewer?.status, navigate]);

  if (isLoading || fetching) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Provisioning state is unknown when the query fails, so say that rather than
  // asserting the user has no workspace — a network blip is not an entitlement.
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="max-w-md space-y-6">
          <Alert variant="destructive">
            <AlertTitle>Could not check your account</AlertTitle>
            <AlertDescription>
              We could not reach the server to see which businesses you belong to. Check your
              connection and try again.
            </AlertDescription>
          </Alert>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => window.location.reload()}>Try again</Button>
            <Button variant="outline" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isEmailUnverified = viewer?.status === 'EMAIL_UNVERIFIED';
  const pendingInvitations = viewer?.pendingInvitations ?? [];

  const handleClaim = async (invitationId: string) => {
    const result = await claimInvitation(invitationId);
    if (result?.success) {
      // The membership now exists server-side, so the stale NO_WORKSPACE answer
      // must not outlive this navigation. Today OnboardingGuard re-queries on
      // mount anyway — the urql client is built without a cache exchange, so
      // nothing is served from cache — but that is a property of the client
      // setup, not of this flow, and a cache exchange would silently reintroduce
      // the bounce. Invalidating explicitly keeps the flow correct either way.
      refreshViewer();
      navigate(ROUTES.HOME, { replace: true });
    }
  };

  return (
    <div className="flex items-center justify-center h-screen px-4">
      <div className="text-center max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">
            {isEmailUnverified
              ? 'Verify your email'
              : pendingInvitations.length > 0
                ? "You've been invited"
                : 'No workspace yet'}
          </h1>
          {viewer?.email ? (
            <p className="text-sm text-muted-foreground">Signed in as {viewer.email}</p>
          ) : null}
        </div>

        {isEmailUnverified ? (
          <p className="text-muted-foreground">
            We sent a verification link to your email address. Open it, then reload this page to
            continue.
          </p>
        ) : pendingInvitations.length > 0 ? (
          <>
            <p className="text-muted-foreground">
              {pendingInvitations.length === 1
                ? 'An invitation is waiting for your email address. Accept it to get started.'
                : 'These invitations are waiting for your email address. Accept one to get started.'}
            </p>
            <ul className="space-y-2">
              {pendingInvitations.map(invitation => (
                <li
                  key={invitation.id}
                  className="flex items-center justify-between gap-4 rounded-md border p-3 text-left"
                >
                  <div>
                    <p className="font-medium">{invitation.businessName ?? 'Unnamed business'}</p>
                    <p className="text-sm text-muted-foreground">as {invitation.roleId}</p>
                  </div>
                  <Button
                    onClick={() => void handleClaim(invitation.id)}
                    disabled={claiming}
                    className="shrink-0"
                  >
                    Accept
                  </Button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground">
            Accounter is invitation-only. Your account is not linked to any business yet — ask an
            administrator of the business you should belong to for an invitation, then open the link
            they send you.
          </p>
        )}

        <div className="flex gap-2 justify-center">
          <Button
            variant={pendingInvitations.length > 0 ? 'outline' : 'default'}
            onClick={refreshViewer}
          >
            Check again
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
