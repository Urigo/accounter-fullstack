import { Dispatch, ReactElement, SetStateAction, useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { useQuery } from 'urql';
import {
  ActionIcon,
  Indicator,
  MultiSelect,
  Pagination,
  Select,
  SimpleGrid,
  Switch,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import {
  AllBusinessesDocument,
  AllTagsDocument,
  ChargeFilter,
  ChargeFilterType,
  ChargeSortByField,
} from '../../gql/graphql.js';
import { isObjectEmpty, sortTags, TIMELESS_DATE_REGEX } from '../../helpers/index.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { accountantApprovalInputData, PopUpModal, SelectTagItem } from '../common/index.js';

interface ChargesFiltersFormProps {
  filter: ChargeFilter;
  setFilter: (filter: ChargeFilter) => void;
  closeModal: () => void;
}

const fieldsToSort: { label: string; value: ChargeSortByField }[] = [
  {
    value: ChargeSortByField.AbsAmount,
    label: 'Abs Amount',
  },
  {
    value: ChargeSortByField.Amount,
    label: 'Amount',
  },
  {
    value: ChargeSortByField.Date,
    label: 'Date',
  },
];

export const chargesTypeFilterOptions: Array<{ label: string; value: ChargeFilterType }> = [
  { label: 'All', value: ChargeFilterType.All },
  { label: 'Income', value: ChargeFilterType.Income },
  { label: 'Expense', value: ChargeFilterType.Expense },
];

function ChargesFiltersForm({
  filter,
  setFilter,
  closeModal,
}: ChargesFiltersFormProps): ReactElement {
  const { control, handleSubmit, watch, setValue } = useForm<ChargeFilter>({
    defaultValues: { ...filter },
  });
  const [asc, setAsc] = useState(filter.sortBy?.asc ?? false);
  const [enableAsc, setEnableAsc] = useState(!!filter.sortBy?.field);
  const [businesses, setBusinesses] = useState<Array<{ value: string; label: string }>>([]);
  const [tags, setTags] = useState<Array<{ value: string; label: string; description?: string }>>(
    [],
  );
  const [{ data: businessesData, fetching: businessesFetching, error: businessesError }] = useQuery(
    {
      query: AllBusinessesDocument,
    },
  );
  const [{ data: tagsData, fetching: tagsFetching, error: tagsError }] = useQuery({
    query: AllTagsDocument,
  });

  const sortByField = watch('sortBy.field');

  useEffect(() => {
    if (sortByField && !enableAsc) {
      setEnableAsc(true);
    } else if (!sortByField && enableAsc) {
      setEnableAsc(false);
    }
  }, [sortByField, enableAsc]);

  useEffect(() => {
    if (businessesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching financial entities! 🤥',
      });
    }
  }, [businessesError]);

  useEffect(() => {
    if (tagsError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching tags! 🤥',
      });
    }
  }, [tagsError]);

  const onSubmit: SubmitHandler<ChargeFilter> = data => {
    if (asc != null && data.sortBy?.field) {
      data.sortBy.asc = asc;
    }
    setFilter(data);
    closeModal();
  };

  function clearFilter(): void {
    setFilter({});
    setAsc(false);
    closeModal();
  }

  // On every new financial entities data fetch, reorder results by name
  useEffect(() => {
    if (businessesData?.allBusinesses?.nodes.length) {
      setBusinesses(
        businessesData.allBusinesses.nodes
          .sort((a, b) => (a.name > b.name ? 1 : -1))
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          })),
      );
    }
  }, [businessesData, setBusinesses]);

  // On every new tags data fetch, reorder results by name
  useEffect(() => {
    if (tagsData?.allTags.length) {
      setTags(
        sortTags(tagsData.allTags).map(entity => ({
          value: entity.id,
          label: entity.name,
          description: entity.namePath ? `${entity.namePath.join(' > ')} >` : undefined,
        })),
      );
    }
  }, [tagsData, setTags]);

  return (
    <>
      {businessesFetching ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)}>
        <SimpleGrid cols={2}>
          <Controller
            name="byOwners"
            control={control}
            defaultValue={filter.byOwners}
            render={({ field, fieldState }): ReactElement => (
              <MultiSelect
                {...field}
                data={businesses}
                value={field.value ?? []}
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
            name="byBusinesses"
            control={control}
            defaultValue={filter.byBusinesses}
            render={({ field, fieldState }): ReactElement => (
              <MultiSelect
                {...field}
                data={businesses}
                value={field.value ?? []}
                disabled={businessesFetching}
                label="Main Businesses"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                withinPortal
              />
            )}
          />
          <Controller
            name="byTags"
            control={control}
            defaultValue={filter.byTags}
            render={({ field, fieldState }): ReactElement => (
              <MultiSelect
                {...field}
                data={tags}
                itemComponent={SelectTagItem}
                value={field.value ?? []}
                disabled={tagsFetching}
                label="Tags"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                withinPortal
                filter={(value, _, item) =>
                  item.label?.toLowerCase().includes(value.toLowerCase().trim()) ||
                  item.description?.toLowerCase().includes(value.toLowerCase().trim())
                }
              />
            )}
          />
          <Controller
            name="fromAnyDate"
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
            name="toAnyDate"
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
            name="chargesType"
            control={control}
            defaultValue={filter.chargesType}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
                data={chargesTypeFilterOptions}
                value={field.value ?? ChargeFilterType.All}
                disabled={businessesFetching}
                label="Charge Type"
                placeholder="Filter income/expense"
                maxDropdownHeight={160}
                error={fieldState.error?.message}
                withinPortal
              />
            )}
          />
          <Controller
            name="sortBy.field"
            control={control}
            defaultValue={filter.sortBy?.field ?? ChargeSortByField.Date}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
                data={fieldsToSort}
                label="Field to sort by"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                rightSectionProps={{ style: { width: '3.5rem' } }}
                withinPortal
                rightSection={
                  <Switch
                    defaultChecked={filter.sortBy?.asc ?? false}
                    checked={asc ?? false}
                    disabled={!enableAsc}
                    onChange={(event): void => setAsc(event.currentTarget.checked)}
                    color="gray"
                    onLabel={<p>ASC</p>}
                    offLabel={<p>DESC</p>}
                  />
                }
              />
            )}
          />
          <Controller
            name="accountantStatus"
            control={control}
            defaultValue={filter.accountantStatus}
            render={({ field, fieldState }): ReactElement => (
              <MultiSelect
                {...field}
                value={field.value ?? []}
                data={accountantApprovalInputData}
                disabled={businessesFetching}
                label="Accountant Status"
                placeholder="All"
                maxDropdownHeight={160}
                error={fieldState.error?.message}
                withinPortal
              />
            )}
          />

          <div className="flex flex-col gap-2 mt-4">
            <span>Missing Information:</span>

            <Switch
              defaultChecked={filter.withoutInvoice ?? false}
              onChange={(event): void => setValue('withoutInvoice', event.currentTarget.checked)}
              label="Without Invoices"
            />

            <Switch
              defaultChecked={filter.withoutDocuments ?? false}
              onChange={(event): void => setValue('withoutDocuments', event.currentTarget.checked)}
              label="Without Documents"
            />

            <Switch
              defaultChecked={filter.unbalanced ?? false}
              onChange={(event): void => setValue('unbalanced', event.currentTarget.checked)}
              label="Unbalanced businesses"
            />

            <Switch
              defaultChecked={filter.withoutLedger ?? false}
              onChange={(event): void => setValue('withoutLedger', event.currentTarget.checked)}
              label="Without ledger"
            />
          </div>
        </SimpleGrid>
        <div className="flex justify-center mt-5 gap-3">
          <button
            type="submit"
            disabled={businessesFetching || tagsFetching}
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

interface ChargesFiltersProps {
  filter: ChargeFilter;
  setFilter: (filter: ChargeFilter) => void;
  activePage: number;
  totalPages?: number;
  setPage: Dispatch<SetStateAction<number>>;
}

export function ChargesFilters({
  filter,
  setFilter,
  activePage,
  setPage,
  totalPages = 1,
}: ChargesFiltersProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const [isFiltered, setIsFiltered] = useState(!isObjectEmpty(filter));
  const { get, set } = useUrlQuery();

  // update url on page change
  useEffect(() => {
    const newPage = activePage > 1 ? activePage.toFixed(0) : null;
    const oldPage = get('page');
    if (newPage !== oldPage) {
      set('page', newPage);
    }
  }, [activePage, get, set]);

  // update url on filter change
  useEffect(() => {
    const newFilter = isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
    const oldFilter = get('chargesFilters');
    if (newFilter !== oldFilter) {
      set('chargesFilters', newFilter);
      set('page');
      setPage(1);
    }
  }, [filter, get, set, setPage]);

  const onSetFilter = useCallback(
    (newFilter: ChargeFilter) => {
      // looks for actual changes before triggering update
      if (!equal(newFilter, filter)) {
        setFilter(newFilter);
        setIsFiltered(!isObjectEmpty(newFilter));
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
          <ChargesFiltersForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
          />
        }
        modalSize="xl"
      />
      {totalPages > 1 && (
        <Pagination
          className="flex-auto"
          value={activePage}
          onChange={setPage}
          total={totalPages}
        />
      )}
      <Indicator inline size={16} disabled={!isFiltered}>
        <ActionIcon variant="default" onClick={(): void => setOpened(true)} size={30}>
          <Filter size={20} />
        </ActionIcon>
      </Indicator>
    </div>
  );
}
