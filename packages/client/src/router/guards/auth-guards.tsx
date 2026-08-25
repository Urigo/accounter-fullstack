import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { PageSkeleton } from '../../components/layout/page-skeleton.js';
import { useViewer } from '../../hooks/use-viewer.js';
import { hasStoredAuth0Session } from '../../lib/auth0-session.js';
import { ROUTES } from '../routes.js';

type GuardProps = {
  children: ReactElement;
};

const isDevAuthEnabled = import.meta.env.VITE_DEV_AUTH === '1';

export function ProtectedRoute({ children }: GuardProps): ReactElement {
  if (isDevAuthEnabled) {
    return children;
  }

  return (
    <Auth0ProtectedRoute>
      <OnboardingGuard>{children}</OnboardingGuard>
    </Auth0ProtectedRoute>
  );
}

function Auth0ProtectedRoute({ children }: GuardProps): ReactElement {
  const { isAuthenticated, isLoading } = useAuth0();
  const location = useLocation();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        replace
        state={{ returnTo: location.pathname + location.search + location.hash }}
      />
    );
  }

  return children;
}

/**
 * Keeps an authenticated-but-unprovisioned user off the app shell.
 *
 * Being signed in to Auth0 is not enough to use Accounter — the identity must be
 * linked to at least one business. Without this guard such a user renders the
 * dashboard over queries that all fail, with no explanation and no way forward.
 *
 * Renders children on a query error rather than trapping the user on /welcome:
 * a network blip should not look like a missing workspace, and every underlying
 * screen handles its own failures.
 */
export function OnboardingGuard({ children }: GuardProps): ReactElement {
  const { fetching, error, viewer } = useViewer();

  if (fetching) {
    return <PageSkeleton />;
  }

  if (!error && viewer && viewer.status !== 'ACTIVE') {
    return <Navigate to={ROUTES.WELCOME} replace />;
  }

  return children;
}

/**
 * Owns the site root, which serves two audiences.
 *
 * A visitor without a session gets the public landing page; anyone already
 * signed in is sent straight into the app. Unlike the other guards this one
 * does not hold the render back on `isLoading` by default — the landing page is
 * the first thing a stranger ever sees, and making them wait on an Auth0 round
 * trip to read marketing copy is the wrong trade. A cached session is the one
 * case worth waiting for: it means a redirect is coming, so painting the
 * marketing page first would only be a flash.
 */
export function LandingRoute({ children }: GuardProps): ReactElement {
  if (isDevAuthEnabled) {
    return <Navigate to={ROUTES.APP_HOME} replace />;
  }

  return <Auth0LandingRoute>{children}</Auth0LandingRoute>;
}

function Auth0LandingRoute({ children }: GuardProps): ReactElement {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return hasStoredAuth0Session() ? <PageSkeleton /> : children;
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.APP_HOME} replace />;
  }

  return children;
}

export function PublicOnlyGuard({ children }: GuardProps): ReactElement {
  if (isDevAuthEnabled) {
    return children;
  }

  return <Auth0PublicOnlyGuard>{children}</Auth0PublicOnlyGuard>;
}

function Auth0PublicOnlyGuard({ children }: GuardProps): ReactElement {
  const { isAuthenticated, isLoading } = useAuth0();
  const location = useLocation();
  const isForcedReauth = new URLSearchParams(location.search).get('reauth') === '1';
  const invitationReturnTo =
    typeof window === 'undefined' ? null : sessionStorage.getItem('auth:invitationReturnTo');

  if (isLoading) {
    return <PageSkeleton />;
  }

  // Allow explicit re-authentication flow to render the login page even when
  // Auth0 still reports an authenticated browser session.
  if (isAuthenticated && !isForcedReauth) {
    if (invitationReturnTo) {
      sessionStorage.removeItem('auth:invitationReturnTo');
    }
    return <Navigate to={invitationReturnTo ?? ROUTES.APP_HOME} replace />;
  }

  return children;
}
