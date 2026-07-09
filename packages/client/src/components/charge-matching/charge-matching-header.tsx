import { type ReactElement } from 'react';
import { Info } from 'lucide-react';
import { ChargeMatchQueueMode, ChargeMatchQueueSortBy } from '../../gql/graphql.js';
import type { TimelessDateString } from '../../helpers/dates.js';
import { useGetBusinesses } from '../../hooks/use-get-businesses.js';
import { ComboBox } from '../common/index.js';
import { Alert, AlertDescription } from '../ui/alert.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs.js';

export type ChargeMatchingFilters = {
  businessId: string | null;
  fromDate: TimelessDateString | null;
  toDate: TimelessDateString | null;
  mode: ChargeMatchQueueMode | null;
  sortBy: ChargeMatchQueueSortBy;
};

export const DEFAULT_CHARGE_MATCHING_FILTERS: ChargeMatchingFilters = {
  businessId: null,
  fromDate: null,
  toDate: null,
  mode: null,
  sortBy: ChargeMatchQueueSortBy.ByDate,
};

const MODE_ALL = 'ALL';

type Props = {
  filters: ChargeMatchingFilters;
  onFiltersChange: (filters: ChargeMatchingFilters) => void;
};

export const ChargeMatchingHeader = ({ filters, onFiltersChange }: Props): ReactElement => {
  const { selectableBusinesses, fetching: fetchingBusinesses } = useGetBusinesses();

  const update = (patch: Partial<ChargeMatchingFilters>): void => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        {/* Filters group */}
        <div className="flex flex-col gap-1">
          <Label htmlFor="charge-matching-mode">Mode</Label>
          <Select
            value={filters.mode ?? MODE_ALL}
            onValueChange={value =>
              update({ mode: value === MODE_ALL ? null : (value as ChargeMatchQueueMode) })
            }
          >
            <SelectTrigger id="charge-matching-mode" className="w-44">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MODE_ALL}>All</SelectItem>
              <SelectItem value={ChargeMatchQueueMode.DocBase}>Doc Base</SelectItem>
              <SelectItem value={ChargeMatchQueueMode.TransactionBase}>Transaction Base</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="charge-matching-from-date">From</Label>
          <Input
            id="charge-matching-from-date"
            type="date"
            className="w-40"
            value={filters.fromDate ?? ''}
            onChange={event =>
              update({ fromDate: (event.target.value as TimelessDateString) || null })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="charge-matching-to-date">To</Label>
          <Input
            id="charge-matching-to-date"
            type="date"
            className="w-40"
            value={filters.toDate ?? ''}
            onChange={event =>
              update({ toDate: (event.target.value as TimelessDateString) || null })
            }
          />
        </div>
        <div className="flex flex-col gap-1 min-w-52">
          <Label>Business</Label>
          <ComboBox
            data={selectableBusinesses}
            disabled={fetchingBusinesses}
            placeholder="All businesses"
            value={filters.businessId}
            onChange={businessId => update({ businessId })}
          />
        </div>

        {/* Sort toggle group (separate from the mode filter) */}
        <div className="flex flex-col gap-1 ml-auto">
          <Label>Sort by</Label>
          <Tabs
            value={filters.sortBy}
            onValueChange={value => update({ sortBy: value as ChargeMatchQueueSortBy })}
          >
            <TabsList>
              <TabsTrigger value={ChargeMatchQueueSortBy.ByDate}>Date</TabsTrigger>
              <TabsTrigger value={ChargeMatchQueueSortBy.ByScore}>Match Score</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {filters.sortBy === ChargeMatchQueueSortBy.ByScore && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            Note: Score-based sorting currently evaluates only the 100 most recent unmatched
            charges.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
