import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { Indicator, MultiSelect, Select, SimpleGrid } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { BalanceReportScreenQueryVariables } from '../../../../gql/graphql.js';
import { isObjectEmpty, TIMELESS_DATE_REGEX } from '../../../../helpers/index.js';
import { useGetBusinesses } from '../../../../hooks/use-get-businesses.js';
import { useGetFinancialEntities } from '../../../../hooks/use-get-financial-entities.js';
import { useGetTags } from '../../../../hooks/use-get-tags.js';
import { useUrlQuery } from '../../../../hooks/use-url-query.js';
import { PopUpModal } from '../../../common/index.js';
import { Button } from '../../../ui/button.js';

export function encodeBalanceReportFilters(filter?: BalanceReportFilter | null): string | null {
  return !filter || isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
}

export const BALANCE_REPORT_FILTERS_QUERY_PARAM = 'balanceReportFilters';

export enum Period {
  MONTHLY = 'Monthly',
  BI_MONTHLY = 'Bi-monthly',
  QUARTERLY = 'Quarterly',
  SEMI_ANNUALLY = 'Semi-Annually',
  ANNUALLY = 'Annually',
}

export type BalanceReportFilter = BalanceReportScreenQueryVariables & {
  period: Period;
  excludedCounterparties: string[];
  includedTags: string[];
  excludedTags: string[];
};

interface BalanceReportFiltersFormProps {
  filter: BalanceReportFilter;
  setFilter: (filter: BalanceReportFilter) => void;
  closeModal: () => void;
}

function BalanceReportFiltersForm({
  filter,
  setFilter,
  closeModal,
}: BalanceReportFiltersFormProps): ReactElement {
  const { control, handleSubmit, watch } = useForm<BalanceReportFilter>({
    defaultValues: { ...filter },
  });
  const { selectableBusinesses: businesses, fetching: businessesFetching } = useGetBusinesses();
  const { selectableFinancialEntities: financialEntities, fetching: financialEntitiesFetching } =
    useGetFinancialEntities();
  const { selectableTags: allTags, fetching: tagsFetching } = useGetTags();

  const onSubmit: SubmitHandler<BalanceReportFilter> = data => {
    setFilter(data);
    closeModal();
  };

  const excludedTags = watch('excludedTags');
  const selectableIncludedTags = useMemo(
    () => allTags.filter(tag => !excludedTags.includes(tag.value)),
    [excludedTags, allTags],
  );

  const includedTags = watch('includedTags');
  const selectableExcludedTags = useMemo(
    () => allTags.filter(tag => !includedTags.includes(tag.value)),
    [includedTags, allTags],
  );
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SimpleGrid cols={2}>
        <Controller
          name="ownerId"
          control={control}
          defaultValue={filter?.ownerId}
          render={({ field, fieldState }): ReactElement => (
            <Select
              {...field}
              data={businesses}
              value={field.value}
              disabled={businessesFetching}
              label="Owners"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
              withinPortal
            />
          )}
        />
        <Controller
          name="fromDate"
          control={control}
          defaultValue={filter?.fromDate}
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
              error={fieldState.error?.message}
              label="From Date"
              popoverProps={{ withinPortal: true }}
            />
          )}
        />
        <Controller
          name="toDate"
          control={control}
          defaultValue={filter?.toDate}
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
              error={fieldState.error?.message}
              label="To Date"
              popoverProps={{ withinPortal: true }}
            />
          )}
        />
        <Controller
          name="period"
          control={control}
          defaultValue={Period.MONTHLY}
          render={({ field, fieldState }): ReactElement => (
            <Select
              {...field}
              data={Object.values(Period).map(period => ({ value: period, label: period }))}
              value={field.value}
              label="Period"
              // placeholder="Filter income/expense"
              maxDropdownHeight={160}
              error={fieldState.error?.message}
              withinPortal
            />
          )}
        />
        <Controller
          name="excludedCounterparties"
          control={control}
          defaultValue={filter.excludedCounterparties}
          render={({ field, fieldState }): ReactElement => (
            <MultiSelect
              {...field}
              data={financialEntities}
              value={field.value ?? []}
              disabled={financialEntitiesFetching}
              label="Excluded Counterparties"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
              withinPortal
            />
          )}
        />
        <Controller
          name="includedTags"
          control={control}
          defaultValue={filter.includedTags}
          render={({ field, fieldState }): ReactElement => (
            <MultiSelect
              {...field}
              data={selectableIncludedTags}
              value={field.value ?? []}
              disabled={tagsFetching}
              label="Included Tags"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
              withinPortal
            />
          )}
        />
        <Controller
          name="excludedTags"
          control={control}
          defaultValue={filter.excludedTags}
          render={({ field, fieldState }): ReactElement => (
            <MultiSelect
              {...field}
              data={selectableExcludedTags}
              value={field.value ?? []}
              disabled={tagsFetching}
              label="Excluded Tags"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
              withinPortal
            />
          )}
        />
      </SimpleGrid>
      <div className="flex justify-center mt-5 gap-3">
        <button
          type="submit"
          disabled={businessesFetching}
          className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
        >
          Filter
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
  );
}

interface BalanceReportFiltersProps {
  filter: BalanceReportFilter;
  setFilter: (filter: BalanceReportFilter) => void;
  initiallyOpened?: boolean;
}

export function BalanceReportFilters({
  filter,
  setFilter,
  initiallyOpened = false,
}: BalanceReportFiltersProps): ReactElement {
  const [opened, setOpened] = useState(initiallyOpened);
  const [isFiltered, setIsFiltered] = useState(!!filter);
  const { get, set } = useUrlQuery();

  // update url on filter change
  useEffect(() => {
    const newFilter = encodeBalanceReportFilters(filter);
    const oldFilter = get(BALANCE_REPORT_FILTERS_QUERY_PARAM);
    if (newFilter !== oldFilter) {
      set(BALANCE_REPORT_FILTERS_QUERY_PARAM, newFilter);
    }
  }, [filter, get, set]);

  const onSetFilter = useCallback(
    (newFilter: BalanceReportFilter) => {
      // looks for actual changes before triggering update
      if (!equal(newFilter, filter)) {
        setFilter(newFilter);
        setIsFiltered(!!newFilter);
      }
    },
    [filter, setFilter],
  );

  return (
    <div className="flex flex-row gap-5 items-center">
      <PopUpModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        content={
          <BalanceReportFiltersForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
          />
        }
        modalSize="xl"
      />
      <Indicator inline size={16} disabled={!isFiltered}>
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={(): void => setOpened(true)}
        >
          <Filter className="size-5" />
        </Button>
      </Indicator>
    </div>
  );
}
