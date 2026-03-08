import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { PageSkeleton } from '../../components/layout/page-skeleton.js';
import { ROUTES } from '../routes.js';

type GuardProps = {
  children: ReactElement;
};

export function RequireAuthGuard({ children }: GuardProps): ReactElement {
  const { isAuthenticated, isLoading } = useAuth0();
  const location = useLocation();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function PublicOnlyGuard({ children }: GuardProps): ReactElement {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return children;
}
