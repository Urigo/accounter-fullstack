import { useState, type ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardLayout as DashboardUI } from '../../components/layout/dashboard-layout.js';
import { FiltersContext } from '../../providers/filters-context.js';
import { OnboardingGuard } from '../guards/onboarding-guard.js';

export function DashboardLayoutRoute(): ReactElement {
  const [filtersContext, setFiltersContext] = useState<ReactElement | null>(null);

  return (
    <OnboardingGuard>
      <FiltersContext.Provider value={{ filtersContext, setFiltersContext }}>
        <DashboardUI filtersContext={filtersContext}>
          <Outlet />
        </DashboardUI>
      </FiltersContext.Provider>
    </OnboardingGuard>
  );
}
