import { useContext, useEffect, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { Indicator, MultiSelect, Select } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { type BusinessTransactionsFilter } from '../../gql/graphql.js';
import { isObjectEmpty, TIMELESS_DATE_REGEX } from '../../helpers/index.js';
import { useGetBusinesses } from '../../hooks/use-get-businesses.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { UserContext } from '../../providers/user-provider.js';
import { PopUpModal } from '../common/index.js';
import { Button } from '../ui/button.js';

export function encodeTransactionsFilters(
  filter?: BusinessTransactionsFilter | null,
): string | null {
  return !filter || isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
}

interface BusinessTransactionsFilterFormProps {
  filter: BusinessTransactionsFilter;
  setFilter: (filter: BusinessTransactionsFilter) => void;
  closeModal: () => void;
  single?: boolean;
}

function BusinessTransactionsFilterForm({
  filter,
  setFilter,
  closeModal,
  single = false,
}: BusinessTransactionsFilterFormProps): ReactElement {
  const { control, handleSubmit } = useForm<BusinessTransactionsFilter>({
    defaultValues: { ...filter },
  });
  const { selectableBusinesses: businesses, fetching: businessesLoading } = useGetBusinesses();

  const { userContext } = useContext(UserContext);

  const onSubmit: SubmitHandler<BusinessTransactionsFilter> = data => {
    setFilter(data);
    closeModal();
  };

  function clearFilter(): void {
    setFilter({
      businessIDs: single ? filter.businessIDs : undefined,
    });
    closeModal();
  }

  return (
    <>
      {businessesLoading ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="ownerIds"
          control={control}
          defaultValue={filter.ownerIds}
          render={({ field, fieldState }): ReactElement => (
            <MultiSelect
              {...field}
              data={businesses}
              value={
                field.value ??
                (userContext?.context.adminBusinessId
                  ? [userContext.context.adminBusinessId]
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
        {!single && (
          <Controller
            name="businessIDs"
            control={control}
            defaultValue={filter.businessIDs}
            render={({ field, fieldState }): ReactElement => (
              <MultiSelect
                {...field}
                data={businesses}
                value={field.value ?? undefined}
                disabled={businessesLoading}
                label="Businesses"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
              />
            )}
          />
        )}
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
              error={fieldState.error?.message}
              label="From Date"
              popoverProps={{ withinPortal: true }}
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
              error={fieldState.error?.message}
              label="To Date"
              popoverProps={{ withinPortal: true }}
            />
          )}
        />
        <Controller
          name="type"
          control={control}
          defaultValue={null}
          render={({ field, fieldState }): ReactElement => (
            <Select
              {...field}
              onChange={value => field.onChange(value === 'NULL' ? null : value)}
              data={[
                { value: 'NULL', label: 'All' },
                { value: 'BUSINESS', label: 'Business' },
                { value: 'TAX_CATEGORY', label: 'Tax Category' },
              ]}
              error={fieldState.error?.message}
              label="Type"
            />
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
    </>
  );
}

interface BusinessTransactionsFilterProps {
  filter: BusinessTransactionsFilter;
  setFilter: (filter: BusinessTransactionsFilter) => void;
}

export function BusinessTransactionsFilters({
  filter,
  setFilter,
}: BusinessTransactionsFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const [isFiltered, setIsFiltered] = useState(!isObjectEmpty(filter));
  const { get, set } = useUrlQuery();

  function isFilterApplied(filter: BusinessTransactionsFilter): boolean {
    const changed = Object.entries(filter ?? {}).filter(
      ([_key, value]) => value !== undefined && Array.isArray(value) && value.length > 0,
    );
    return changed.length > 0;
  }

  function onSetFilter(newFilter: BusinessTransactionsFilter): void {
    if (newFilter.fromDate?.trim() === '') newFilter.fromDate = undefined;
    if (newFilter.toDate?.trim() === '') newFilter.toDate = undefined;
    // looks for actual changes before triggering update
    if (!equal(newFilter, filter)) {
      setFilter(newFilter);
      setIsFiltered(isFilterApplied(newFilter));
    }
  }

  // update url on filter change
  useEffect(() => {
    const newFilter = isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
    const oldFilter = get('transactionsFilters');
    if (newFilter !== oldFilter) {
      set('transactionsFilters', newFilter);
    }
  }, [filter, get, set]);

  return (
    <>
      <PopUpModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        content={
          <BusinessTransactionsFilterForm
            single
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
          />
        }
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
    </>
  );
}
