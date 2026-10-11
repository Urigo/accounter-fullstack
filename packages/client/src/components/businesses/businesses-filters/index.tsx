import { useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react';
import { ListFilter, Search } from 'lucide-react';
import { Badge } from '../../ui/badge.js';
import { Button } from '../../ui/button.js';
import { Dialog, DialogContent, DialogTrigger } from '../../ui/dialog.js';
import { Input } from '../../ui/input.js';
import { Spinner } from '../../ui/spinner.js';
import { BusinessesFiltersForm } from './businesses-filters-form.js';
import {
  countActiveFilters,
  normalizeBusinessesFilter,
  type BusinessesPageFilter,
} from './schema.js';

export { useBusinessesFilter } from './use-businesses-filter.js';
export { hasActiveFilters, toServerFilter, type BusinessesPageFilter } from './schema.js';

const NAME_DEBOUNCE_MS = 600;

interface BusinessesFiltersProps {
  filter: BusinessesPageFilter;
  setFilter: Dispatch<SetStateAction<BusinessesPageFilter>>;
  /** True while the lazy usage query (which drives "Unused only") is in flight. */
  usageLoading?: boolean;
}

/**
 * The businesses toolbar filters: an inline name search — the most common filter, so it stays
 * one keystroke away — next to a Filters button opening the dialog for everything else.
 */
export function BusinessesFilters({
  filter,
  setFilter,
  usageLoading = false,
}: BusinessesFiltersProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const [inputName, setInputName] = useState(filter.name ?? '');
  const activeCount = countActiveFilters(filter);

  // Debounce the search so typing doesn't re-query the directory on every keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => {
      const name = inputName.trim() || undefined;
      setFilter(prev =>
        (prev.name ?? undefined) === name ? prev : normalizeBusinessesFilter({ ...prev, name }),
      );
    }, NAME_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
    };
  }, [inputName, setFilter]);

  // Follow a name changed from outside (browser back / forward). Compared trimmed, so the
  // debounced write-back above doesn't eat a trailing space the user is still typing past.
  useEffect(() => {
    const name = filter.name ?? '';
    setInputName(current => (current.trim() === name ? current : name));
  }, [filter.name]);

  return (
    <div className="flex flex-row items-center gap-2">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          className="ps-8"
          placeholder="Search by name"
          aria-label="Search businesses by name"
          value={inputName}
          onChange={event => setInputName(event.target.value)}
        />
      </div>
      <Dialog open={opened} onOpenChange={setOpened}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            {filter.unusedOnly && usageLoading ? <Spinner /> : <ListFilter />}
            Filters
            {activeCount > 0 && (
              <Badge className="absolute -end-1.5 -top-1.5 size-4 justify-center rounded-full p-0 text-xs tabular-nums">
                {activeCount}
              </Badge>
            )}
            {activeCount > 0 && <span className="sr-only">({activeCount} active)</span>}
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <BusinessesFiltersForm
            filter={filter}
            setFilter={setFilter}
            closeModal={(): void => setOpened(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
