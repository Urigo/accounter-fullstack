import { ReactElement, useEffect, useMemo, useState } from 'react';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Indicator, MultiSelect } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { AllFinancialEntitiesDocument, BusinessTransactionsFilter } from '../../gql/graphql.js';
import {
  DEFAULT_FINANCIAL_ENTITY_ID,
  isObjectEmpty,
  TIMELESS_DATE_REGEX,
} from '../../helpers/index.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { PopUpModal, TextInput } from '../common/index.js';

interface BusinessTransactionsFilterFormProps {
  filter: BusinessTransactionsFilter;
  setFilter: (filter: BusinessTransactionsFilter) => void;
  closeModal: () => void;
}

function BusinessTransactionsFilterForm({
  filter,
  setFilter,
  closeModal,
}: BusinessTransactionsFilterFormProps): ReactElement {
  const { control, handleSubmit } = useForm<BusinessTransactionsFilter>({
    defaultValues: { ...filter },
  });
  const [{ data: feData, fetching: feLoading, error: feError }] = useQuery({
    query: AllFinancialEntitiesDocument,
  });

  useEffect(() => {
    if (feError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching financial entities! 🤥',
      });
    }
  }, [feError]);

  const businesses = useMemo(() => {
    return (
      feData?.allFinancialEntities?.nodes
        .map(entity => ({
          value: entity.id,
          label: entity.name,
        }))
        .sort((a, b) => (a.label > b.label ? 1 : -1)) ?? []
    );
  }, [feData]);

  const onSubmit: SubmitHandler<BusinessTransactionsFilter> = data => {
    setFilter(data);
    closeModal();
  };

  function clearFilter(): void {
    setFilter({});
    closeModal();
  }

  return (
    <>
      {feLoading ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="ownerIds"
          control={control}
          defaultValue={filter.ownerIds}
          render={({ field, fieldState }): ReactElement => (
            <MultiSelect
              {...field}
              data={businesses}
              value={field.value ?? [DEFAULT_FINANCIAL_ENTITY_ID]}
              disabled={feLoading}
              label="Owners"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="businessIDs"
          control={control}
          defaultValue={filter.businessIDs}
          render={({ field, fieldState }): ReactElement => (
            <MultiSelect
              {...field}
              data={businesses}
              value={field.value ?? undefined}
              disabled={feLoading}
              label="Businesses"
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
            <TextInput
              {...field}
              value={
                !field.value || (field.value as string) === 'Missing' ? undefined : field.value
              }
              error={fieldState.error?.message}
              label="From Date"
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
            <TextInput
              {...field}
              value={
                !field.value || (field.value as string) === 'Missing' ? undefined : field.value
              }
              error={fieldState.error?.message}
              label="To Date"
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
