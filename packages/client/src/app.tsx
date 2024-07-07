import { ReactElement, useState } from 'react';
import { FiltersContext } from './providers/filters-context';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { userService } from './services/user-service';

export const router = createRouter({
  routeTree,
  context: {
    filtersContext: null,
    setFiltersContext: () => { },
    userServices: undefined!
  }
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App(): ReactElement {
  const [filtersContext, setFiltersContext] = useState<ReactElement | null>(null);
  const servicesForUser = userService;

  return (
    <FiltersContext.Provider value={{ filtersContext, setFiltersContext }}>
      <RouterProvider router={router} context={{ filtersContext, setFiltersContext, userServices: servicesForUser }} />
    </FiltersContext.Provider>
  );
}
