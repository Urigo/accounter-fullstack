import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from 'react';
import { Filter } from 'lucide-react';
import { areFiltersEqual, normalizeFilter } from '@/router/routes.js';
import type { ChargeFilter } from '../../../gql/graphql.js';
import { Pagination } from '../../common/index.js';
import { Badge } from '../../ui/badge.js';
import { Button } from '../../ui/button.js';
import { Dialog, DialogContent, DialogTrigger } from '../../ui/dialog.js';
import { ChargesFiltersForm } from './charges-filters-form.js';
import { countActiveFilters } from './counts.js';

export { chargesTypeFilterOptions } from './constants.js';
export { useChargesFilter } from './use-charges-filter.js';

interface ChargesFiltersProps {
  filter?: ChargeFilter;
  setFilter: (filter: ChargeFilter) => void;
  activePage: number;
  totalPages?: number;
  setPage: Dispatch<SetStateAction<number>>;
  initiallyOpened?: boolean;
  withDefaultDateRange?: boolean;
}

export function ChargesFilters({
  filter = {},
  setFilter,
  activePage,
  setPage,
  totalPages = 1,
  initiallyOpened = false,
  withDefaultDateRange = true,
}: ChargesFiltersProps): ReactElement {
  const [opened, setOpened] = useState(initiallyOpened);

  // Derived rather than held in state, so it stays correct when `filter` changes
  // from outside the modal (browser back/forward, a deep link).
  const activeCount = useMemo(() => countActiveFilters(filter), [filter]);

  const onSetFilter = useCallback(
    (newFilter: ChargeFilter) => {
      // Only a real change: the screens re-query on every new filter object.
      if (!areFiltersEqual(newFilter, filter)) {
        setFilter(normalizeFilter(newFilter));
      }
    },
    [filter, setFilter],
  );

  return (
    <div className="flex flex-row gap-5 items-center">
      {totalPages > 1 && (
        <Pagination
          className="flex-fit w-fit mx-0"
          currentPageIndex={activePage}
          onChange={setPage}
          totalPages={totalPages}
        />
      )}
      <Dialog open={opened} onOpenChange={setOpened}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="relative size-7.5">
            <Filter className="size-5" />
            {activeCount > 0 && (
              <Badge className="absolute -end-1.5 -top-1.5 size-4 justify-center rounded-full p-0 text-xs tabular-nums">
                {activeCount}
              </Badge>
            )}
            <span className="sr-only">
              {activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters'}
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <ChargesFiltersForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
            withDefaultDateRange={withDefaultDateRange}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
