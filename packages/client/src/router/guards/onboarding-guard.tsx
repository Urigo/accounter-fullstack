import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useOnboardingComplete } from '../../components/screens/onboarding/index.js';
import { useSetupCompletion } from '../../hooks/use-setup-completion.js';
import { ROUTES } from '../routes.js';

export function OnboardingGuard({
  children,
}: {
  children: ReactElement;
}): ReactElement {
  const location = useLocation();
  const { isFirstRun, isLoading } = useSetupCompletion();
  const { isComplete } = useOnboardingComplete();

  if (isLoading) {
    return children;
  }

  const isOnboardingPath = location.pathname === ROUTES.ONBOARDING;

  if (isFirstRun && !isComplete && !isOnboardingPath) {
    return <Navigate to={ROUTES.ONBOARDING} replace />;
  }

  return children;
}
