import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { format, sub } from 'date-fns';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { ActionIcon, Indicator, MultiSelect, SimpleGrid, Switch } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DocumentsFilters as DocumentsFiltersType } from '../../../../gql/graphql.js';
import { TimelessDateString } from '../../../../helpers/dates.js';
import { isObjectEmpty, TIMELESS_DATE_REGEX } from '../../../../helpers/index.js';
import { useGetFinancialEntities } from '../../../../hooks/use-get-financial-entities.js';
import { useUrlQuery } from '../../../../hooks/use-url-query.js';
import { UserContext } from '../../../../providers/user-provider.js';
import { PopUpModal } from '../../../common/index.js';

interface DocumentsFiltersFormProps {
  filter: DocumentsFiltersType;
  setFilter: (filter: DocumentsFiltersType) => void;
  closeModal: () => void;
}

function DocumentsFiltersForm({
  filter,
  setFilter,
  closeModal,
}: DocumentsFiltersFormProps): ReactElement {
  const { userContext } = useContext(UserContext);
  const { control, handleSubmit, setValue } = useForm<DocumentsFiltersType>({
    defaultValues: {
      ownerIDs: userContext?.context.adminBusinessId
        ? [userContext.context.adminBusinessId]
        : undefined,
      toDate: format(new Date(), 'yyyy-MM-dd') as TimelessDateString,
      fromDate: format(sub(new Date(), { years: 1 }), 'yyyy-MM-dd') as TimelessDateString,
      ...filter,
    },
  });
  const { selectableFinancialEntities: financialEntities, fetching: financialEntitiesFetching } =
    useGetFinancialEntities();

  const onSubmit: SubmitHandler<DocumentsFiltersType> = data => {
    setFilter(data);
    closeModal();
  };

  function clearFilter(): void {
    setFilter({});
    closeModal();
  }

  return (
    <>
      {financialEntitiesFetching ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)}>
        <SimpleGrid cols={2}>
          <Controller
            name="ownerIDs"
            control={control}
            defaultValue={filter.ownerIDs}
            render={({ field, fieldState }): ReactElement => (
              <MultiSelect
                {...field}
                data={financialEntities}
                value={field.value ?? []}
                disabled={financialEntitiesFetching}
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
            name="businessIDs"
            control={control}
            defaultValue={filter.businessIDs}
            render={({ field, fieldState }): ReactElement => (
              <MultiSelect
                {...field}
                data={financialEntities}
                value={field.value ?? []}
                disabled={financialEntitiesFetching}
                label="Financial Entities"
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
          <Switch
            defaultChecked={filter.unmatched ?? false}
            onChange={(event): void => setValue('unmatched', event.currentTarget.checked)}
            label="Unmatched only"
          />
        </SimpleGrid>
        <div className="flex justify-center mt-5 gap-3">
          <button
            type="submit"
            disabled={financialEntitiesFetching}
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

interface DocumentsFiltersProps {
  filter?: DocumentsFiltersType;
  setFilter: (filter: DocumentsFiltersType) => void;
  initiallyOpened?: boolean;
}

export function DocumentsFilters({
  filter = {},
  setFilter,
  initiallyOpened = false,
}: DocumentsFiltersProps): ReactElement {
  const [opened, setOpened] = useState(initiallyOpened);
  const [isFiltered, setIsFiltered] = useState(!isObjectEmpty(filter));
  const { get, set } = useUrlQuery();

  // update url on filter change
  useEffect(() => {
    const newFilter = isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
    const oldFilter = get('documentsFilters');
    if (newFilter !== oldFilter) {
      set('documentsFilters', newFilter);
    }
  }, [filter, get, set]);

  const onSetFilter = useCallback(
    (newFilter: DocumentsFiltersType) => {
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
          <DocumentsFiltersForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
          />
        }
        modalSize="xl"
      />
      <Indicator inline size={16} disabled={!isFiltered}>
        <ActionIcon variant="default" onClick={(): void => setOpened(true)} size={30}>
          <Filter size={20} />
        </ActionIcon>
      </Indicator>
    </div>
  );
}
