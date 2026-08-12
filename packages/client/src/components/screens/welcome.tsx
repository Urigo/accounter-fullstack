import { useEffect, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
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
 */
export function WelcomePage(): ReactElement {
  const { isAuthenticated, isLoading } = useAuth0();
  // This route is public, so it can be opened without a session. Waiting for
  // Auth0 keeps an unauthenticated visitor from spending a request to learn
  // nothing, and keeps an authenticated one from asking before their token is
  // attached — which would answer "no workspace" for a perfectly good account.
  const { fetching, error, viewer } = useViewer({ pause: isLoading || !isAuthenticated });
  const handleLogout = useLogout();
  const navigate = useNavigate();

  // Provisioning can complete out-of-band (an admin adds the membership), so
  // send an already-active viewer back to the app rather than stranding them.
  useEffect(() => {
    if (viewer?.status === 'ACTIVE') {
      navigate(ROUTES.HOME, { replace: true });
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

  return (
    <div className="flex items-center justify-center h-screen px-4">
      <div className="text-center max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">
            {isEmailUnverified ? 'Verify your email' : 'No workspace yet'}
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
        ) : (
          <p className="text-muted-foreground">
            Accounter is invitation-only. Your account is not linked to any business yet — ask an
            administrator of the business you should belong to for an invitation, then open the link
            they send you.
          </p>
        )}

        <div className="flex gap-2 justify-center">
          <Button onClick={() => window.location.reload()}>Check again</Button>
          <Button variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
