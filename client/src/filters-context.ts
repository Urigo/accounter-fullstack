/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, ReactElement } from 'react';

type ContextType = {
  filtersContext: ReactElement | null;
  setFiltersContext: (filtersContext: ReactElement | null) => void;
};

export const FiltersContext = createContext<ContextType>({
  filtersContext: null,
  setFiltersContext: () => void 0,
});
