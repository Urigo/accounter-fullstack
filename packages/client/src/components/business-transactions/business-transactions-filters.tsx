import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Indicator, MultiSelect, Select } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { AllBusinessesDocument, BusinessTransactionsFilter } from '../../gql/graphql.js';
import { isObjectEmpty, TIMELESS_DATE_REGEX } from '../../helpers/index.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { UserContext } from '../../providers/user-provider.js';
import { PopUpModal } from '../common/index.js';

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
  const [{ data: businessesData, fetching: businessesLoading, error: businessesError }] = useQuery({
    query: AllBusinessesDocument,
  });

  const { userContext } = useContext(UserContext);

  useEffect(() => {
    if (businessesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching businesses! 🤥',
      });
    }
  }, [businessesError]);

  const businesses = useMemo(() => {
    return (
      businessesData?.allBusinesses?.nodes
        .map(entity => ({
          value: entity.id,
          label: entity.name,
        }))
        .sort((a, b) => (a.label > b.label ? 1 : -1)) ?? []
    );
  }, [businessesData]);

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
              value={field.value ?? [userContext?.ownerId]}
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
            className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
          >
            Filter
          </button>
          <button
            type="button"
            className="text-white bg-orange-500 border-0 py-2 px-8 focus:outline-none hover:bg-orange-600 rounded text-lg"
            onClick={clearFilter}
          >
            Clear
          </button>
          <button
            type="button"
            className="text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
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
        <ActionIcon variant="default" onClick={(): void => setOpened(true)} size={30}>
          <Filter size={20} />
        </ActionIcon>
      </Indicator>
    </>
  );
}
