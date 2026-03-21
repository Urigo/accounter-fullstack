import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSetupCompletion } from '../../hooks/use-setup-completion.js';
import { ROUTES } from '../routes.js';

export function OnboardingGuard({
  children,
}: {
  children: ReactElement;
}): ReactElement {
  const location = useLocation();
  const { isFirstRun, isLoading } = useSetupCompletion();

  if (isLoading) {
    return children;
  }

  const isOnboardingPath = location.pathname === ROUTES.ONBOARDING;

  // Redirect to onboarding only when server data confirms nothing is set up.
  // The localStorage flag is intentionally not used here — it caused false
  // redirects in incognito/new-session contexts where localStorage is empty.
  if (isFirstRun && !isOnboardingPath) {
    return <Navigate to={ROUTES.ONBOARDING} replace />;
  }

  return children;
}
