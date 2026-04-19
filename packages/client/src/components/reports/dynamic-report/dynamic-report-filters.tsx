import { useContext, useEffect, useState, type ReactElement } from 'react';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Indicator, MultiSelect } from '@mantine/core';
import { encodeFilters } from '@/router/routes.js';
import type { BusinessTransactionsFilter } from '../../../gql/graphql.js';
import {
  DYNAMIC_REPORT_FILTERS_KEY,
  isObjectEmpty,
  TIMELESS_DATE_REGEX,
} from '../../../helpers/index.js';
import { useGetBusinesses } from '../../../hooks/use-get-businesses.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { UserContext } from '../../../providers/user-provider.js';
import { DatePickerInput } from '../../common/index.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Switch } from '../../ui/switch.js';

export type DynamicReportFiltersType = BusinessTransactionsFilter & {
  isShowZeroedAccounts?: boolean;
};

interface DynamicReportFilterFormProps {
  filter: DynamicReportFiltersType;
  setFilter: (filter: DynamicReportFiltersType) => void;
  closeModal: () => void;
}

function DynamicReportFilterForm({
  filter,
  setFilter,
  closeModal,
}: DynamicReportFilterFormProps): ReactElement {
  const form = useForm<DynamicReportFiltersType>({
    defaultValues: { ...filter },
  });
  const { control, handleSubmit } = form;
  const { selectableBusinesses: businesses, fetching: businessesLoading } = useGetBusinesses();
  const { userContext } = useContext(UserContext);

  const onSubmit: SubmitHandler<DynamicReportFiltersType> = data => {
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
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <FormField
            name="ownerIds"
            control={control}
            defaultValue={undefined}
            render={({ field, fieldState }): ReactElement => (
              <FormItem>
                <FormLabel>Owners</FormLabel>
                <FormControl>
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
                    placeholder="Scroll to see all options"
                    maxDropdownHeight={160}
                    searchable
                    error={fieldState.error?.message}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="fromDate"
            control={control}
            defaultValue={filter.fromDate}
            rules={{
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be in format yyyy-mm-dd',
              },
            }}
            render={({ field, fieldState }): ReactElement => (
              <FormItem>
                <FormLabel htmlFor="dynamic-report-from-date">From Date</FormLabel>
                <FormControl>
                  <DatePickerInput
                    id="dynamic-report-from-date"
                    onChange={date => {
                      if (date !== field.value) field.onChange(date);
                    }}
                    value={field.value ?? undefined}
                    aria-invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="toDate"
            control={control}
            defaultValue={filter.toDate}
            rules={{
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be in format yyyy-mm-dd',
              },
            }}
            render={({ field, fieldState }): ReactElement => (
              <FormItem>
                <FormLabel htmlFor="dynamic-report-to-date">To Date</FormLabel>
                <FormControl>
                  <DatePickerInput
                    id="dynamic-report-to-date"
                    onChange={date => {
                      if (date !== field.value) field.onChange(date);
                    }}
                    value={field.value ?? undefined}
                    aria-invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="isShowZeroedAccounts"
            control={control}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel htmlFor="dynamic-report-show-zeroed-accounts">
                    Show zeroed accounts
                  </FormLabel>
                </div>
                <FormControl>
                  <Switch
                    id="dynamic-report-show-zeroed-accounts"
                    checked={field.value === true}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
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
      </Form>
    </>
  );
}

interface DynamicReportFilterProps {
  filter: DynamicReportFiltersType;
  setFilter: (filter: DynamicReportFiltersType) => void;
}

export function DynamicReportFilters({
  filter,
  setFilter,
}: DynamicReportFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const [isFiltered, setIsFiltered] = useState(!isObjectEmpty(filter));
  const { get, set } = useUrlQuery();

  function isFilterApplied(filter: DynamicReportFiltersType): boolean {
    const changed = Object.entries(filter ?? {}).filter(
      ([_key, value]) => value !== undefined && Array.isArray(value) && value.length > 0,
    );
    return changed.length > 0;
  }

  function onSetFilter(newFilter: DynamicReportFiltersType): void {
    // looks for actual changes before triggering update
    if (!equal(newFilter, filter)) {
      setFilter(newFilter);
      setIsFiltered(isFilterApplied(newFilter));
    }
  }

  // update url on filter change
  useEffect(() => {
    const newFilter = encodeFilters(filter);
    const oldFilter = get(DYNAMIC_REPORT_FILTERS_KEY);
    if (newFilter !== oldFilter) {
      set(DYNAMIC_REPORT_FILTERS_KEY, newFilter);
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
          <DialogTitle>Dynamic report filters</DialogTitle>
        </DialogHeader>
        <DynamicReportFilterForm
          filter={filter}
          setFilter={onSetFilter}
          closeModal={(): void => setOpened(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
