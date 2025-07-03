import { ReactElement, useContext, useEffect, useState } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { Indicator, MultiSelect } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { BusinessTransactionsFilter } from '../../../gql/graphql.js';
import { isObjectEmpty, TIMELESS_DATE_REGEX } from '../../../helpers/index.js';
import { useGetBusinesses } from '../../../hooks/use-get-businesses.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { UserContext } from '../../../providers/user-provider.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import { Label } from '../../ui/label.js';
import { Switch } from '../../ui/switch.js';
import { CONTO_REPORT_FILTERS_KEY } from './index.js';

export function encodeContoReportFilters(filter?: ContoReportFiltersType | null): string | null {
  if (!filter || isObjectEmpty(filter)) return null;
  return encodeURIComponent(JSON.stringify(filter));
}

export type ContoReportFiltersType = BusinessTransactionsFilter & {
  isShowZeroedAccounts?: boolean;
};

interface ContoReportFilterFormProps {
  filter: ContoReportFiltersType;
  setFilter: (filter: ContoReportFiltersType) => void;
  closeModal: () => void;
}

function ContoReportFilterForm({
  filter,
  setFilter,
  closeModal,
}: ContoReportFilterFormProps): ReactElement {
  const [isShowZeroedAccounts, setIsShowZeroedAccounts] = useState<boolean>(
    filter.isShowZeroedAccounts ?? false,
  );
  const { control, handleSubmit } = useForm<ContoReportFiltersType>({
    defaultValues: { ...filter },
  });
  const { selectableBusinesses: businesses, fetching: businessesLoading } = useGetBusinesses();
  const { userContext } = useContext(UserContext);

  const onSubmit: SubmitHandler<ContoReportFiltersType> = data => {
    data.isShowZeroedAccounts = isShowZeroedAccounts ?? false;
    if (data.fromDate?.trim() === '') data.fromDate = undefined;
    if (data.toDate?.trim() === '') data.toDate = undefined;
    setFilter(data);
    closeModal();
  };

  function clearFilter(): void {
    setFilter({});
    closeModal();
  }

  return (
    <>
      {businessesLoading ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <Controller
          name="ownerIds"
          control={control}
          defaultValue={undefined}
          render={({ field, fieldState }): ReactElement => (
            <MultiSelect
              {...field}
              data={businesses}
              value={
                field.value ??
                (userContext?.context.adminBusinessId
                  ? [userContext?.context.adminBusinessId]
                  : undefined)
              }
              disabled={businessesLoading}
              label="Owners"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="fromDate"
          control={control}
          defaultValue={filter.fromDate}
          rules={{
            pattern: {
              value: TIMELESS_DATE_REGEX,
              message: 'Date must be im format yyyy-mm-dd',
            },
          }}
          render={({ field, fieldState }): ReactElement => (
            <DatePickerInput
              {...field}
              onChange={(date?: Date | string | null): void => {
                const newDate = date
                  ? typeof date === 'string'
                    ? date
                    : format(date, 'yyyy-MM-dd')
                  : undefined;
                if (newDate !== field.value) field.onChange(newDate);
              }}
              value={field.value ? new Date(field.value) : undefined}
              label="From Date"
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="toDate"
          control={control}
          defaultValue={filter.toDate}
          rules={{
            pattern: {
              value: TIMELESS_DATE_REGEX,
              message: 'Date must be im format yyyy-mm-dd',
            },
          }}
          render={({ field, fieldState }): ReactElement => (
            <DatePickerInput
              {...field}
              onChange={(date?: Date | string | null): void => {
                const newDate = date
                  ? typeof date === 'string'
                    ? date
                    : format(date, 'yyyy-MM-dd')
                  : undefined;
                if (newDate !== field.value) field.onChange(newDate);
              }}
              value={field.value ? new Date(field.value) : undefined}
              label="To Date"
              error={fieldState.error?.message}
            />
          )}
        />
        <div className="flex items-center space-x-2">
          <Switch
            checked={isShowZeroedAccounts ?? false}
            onCheckedChange={(): void => setIsShowZeroedAccounts(value => !value)}
          />
          <Label htmlFor="enable-dnd">Show zeroed accounts</Label>
        </div>
        <div className="flex justify-center mt-5 gap-3">
          <button
            type="submit"
            className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
          >
            Filter
          </button>
          <button
            type="button"
            className="text-white bg-orange-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-orange-600 rounded-sm text-lg"
            onClick={clearFilter}
          >
            Clear
          </button>
          <button
            type="button"
            className="text-white bg-rose-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-rose-600 rounded-sm text-lg"
            onClick={closeModal}
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}

interface ContoReportFilterProps {
  filter: ContoReportFiltersType;
  setFilter: (filter: ContoReportFiltersType) => void;
}

export function ContoReportFilters({ filter, setFilter }: ContoReportFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const [isFiltered, setIsFiltered] = useState(!isObjectEmpty(filter));
  const { get, set } = useUrlQuery();

  function isFilterApplied(filter: ContoReportFiltersType): boolean {
    const changed = Object.entries(filter ?? {}).filter(
      ([_key, value]) => value !== undefined && Array.isArray(value) && value.length > 0,
    );
    return changed.length > 0;
  }

  function onSetFilter(newFilter: ContoReportFiltersType): void {
    // looks for actual changes before triggering update
    if (!equal(newFilter, filter)) {
      setFilter(newFilter);
      setIsFiltered(isFilterApplied(newFilter));
    }
  }

  // update url on filter change
  useEffect(() => {
    const newFilter = isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
    const oldFilter = get(CONTO_REPORT_FILTERS_KEY);
    if (newFilter !== oldFilter) {
      set(CONTO_REPORT_FILTERS_KEY, newFilter);
    }
  }, [filter, get, set]);

  return (
    <Dialog open={opened} onOpenChange={setOpened}>
      <DialogTrigger asChild>
        <Indicator inline size={16} disabled={!isFiltered}>
          <Button variant="outline" onClick={(): void => setOpened(true)} className="p-2">
            <Filter size={20} />
          </Button>
        </Indicator>
      </DialogTrigger>
      <DialogContent className="w-100 max-w-screen-md">
        <DialogHeader>
          <DialogTitle>Conto report filters</DialogTitle>
        </DialogHeader>
        <ContoReportFilterForm
          filter={filter}
          setFilter={onSetFilter}
          closeModal={(): void => setOpened(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
