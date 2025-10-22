import { useState, type ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardLayout as DashboardUI } from '../../components/layout/dashboard-layout.js';
import { FiltersContext } from '../../providers/filters-context.js';

/**
 * Dashboard layout route wrapper
 * Provides the dashboard UI with sidebar, header, footer
 */
export function DashboardLayoutRoute(): ReactElement {
  const [filtersContext, setFiltersContext] = useState<ReactElement | null>(null);

  return (
    <FiltersContext.Provider value={{ filtersContext, setFiltersContext }}>
      <DashboardUI filtersContext={filtersContext}>
        <Outlet />
      </DashboardUI>
    </FiltersContext.Provider>
  );
}
