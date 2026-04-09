import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { PageSkeleton } from '../../components/layout/page-skeleton.js';
import { ROUTES } from '../routes.js';

type GuardProps = {
  children: ReactElement;
};

const isDevAuthEnabled = import.meta.env.VITE_DEV_AUTH === '1';

export function ProtectedRoute({ children }: GuardProps): ReactElement {
  if (isDevAuthEnabled) {
    return children;
  }

  return <Auth0ProtectedRoute>{children}</Auth0ProtectedRoute>;
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
    return <Navigate to={invitationReturnTo ?? ROUTES.HOME} replace />;
  }

  return children;
}
