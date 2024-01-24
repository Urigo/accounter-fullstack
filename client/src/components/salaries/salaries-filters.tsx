import { ReactElement, useCallback, useEffect, useState } from 'react';
import { format, startOfYear } from 'date-fns';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, MultiSelect } from '@mantine/core';
import { MonthPicker } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { AllEmployeesByEmployerDocument } from '../../gql/graphql.js';
import { DEFAULT_FINANCIAL_ENTITY_ID, isObjectEmpty, TimelessDateString } from '../../helpers';
import { useUrlQuery } from '../../hooks/use-url-query';
import { PopUpModal } from '../common';

export type SalariesFilter = {
  fromDate: TimelessDateString;
  toDate: TimelessDateString;
  employeeIDs?: Array<string>;
};

export function getDefaultFilterDates(): {
  fromDate: TimelessDateString;
  toDate: TimelessDateString;
} {
  const now = new Date();
  const fromDate = format(now, 'yyyy-MM-dd') as TimelessDateString;
  const toDate = format(startOfYear(now), 'yyyy-MM-dd') as TimelessDateString;

  return { fromDate, toDate };
}

interface SalariesFiltersFormProps {
  filter: SalariesFilter;
  setFilter: (filter: SalariesFilter) => void;
  closeModal: () => void;
}

function SalariesFiltersForm({
  filter,
  setFilter,
  closeModal,
}: SalariesFiltersFormProps): ReactElement {
  const { control, handleSubmit, setValue } = useForm<SalariesFilter>({
    defaultValues: { ...filter },
  });
  const [employees, setEmployees] = useState<Array<{ value: string; label: string }>>([]);
  const [{ data: employeesData, fetching: employeesFetching, error: financialEntitiesError }] =
    useQuery({
      query: AllEmployeesByEmployerDocument,
      variables: {
        employerId: DEFAULT_FINANCIAL_ENTITY_ID,
      },
    });

  useEffect(() => {
    if (financialEntitiesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching employees! 🤥',
      });
    }
  }, [financialEntitiesError]);

  const onSubmit: SubmitHandler<SalariesFilter> = data => {
    if (data.employeeIDs?.length === 0) {
      delete data.employeeIDs;
    }

    setFilter(data);
    closeModal();
  };

  function clearFilter(): void {
    setFilter({
      ...getDefaultFilterDates(),
    });
    closeModal();
  }

  // On every new financial entities data fetch, reorder results by name
  useEffect(() => {
    if (employeesData?.employeesByEmployerId.length) {
      setEmployees(
        employeesData.employeesByEmployerId
          .filter(employee => !employee.name.toLocaleLowerCase().includes('batched'))
          .map(employee => ({
            value: employee.id,
            label: employee.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [employeesData, setEmployees]);

  function onSelectDateRange([fromDate, toDate]: [Date | null, Date | null]): void {
    if (toDate) {
      const to = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);
      setValue('toDate', format(to, 'yyyy-MM-dd') as TimelessDateString);
    }
    if (fromDate) {
      const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      setValue('fromDate', format(from, 'yyyy-MM-dd') as TimelessDateString);
    }
  }

  const defaultDates = getDefaultFilterDates();

  return (
    <>
      {employeesFetching ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)}>
        <MonthPicker
          type="range"
          numberOfColumns={2}
          defaultValue={[
            new Date(filter?.fromDate ?? defaultDates.fromDate),
            new Date(filter?.toDate ?? defaultDates.toDate),
          ]}
          defaultDate={new Date(filter?.fromDate ?? defaultDates.fromDate)}
          onChange={onSelectDateRange}
        />
        <Controller
          name="employeeIDs"
          control={control}
          defaultValue={filter.employeeIDs}
          render={({ field, fieldState }): ReactElement => (
            <MultiSelect
              {...field}
              data={employees}
              value={field.value ?? []}
              disabled={employeesFetching}
              label="Employees"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
            />
          )}
        />
        <div className="flex justify-center mt-5 gap-3">
          <button
            type="submit"
            disabled={employeesFetching}
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

interface SalariesFiltersProps {
  filter: SalariesFilter;
  setFilter: (filter: SalariesFilter) => void;
}

export function SalariesFilters({ filter, setFilter }: SalariesFiltersProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const { get, set } = useUrlQuery();

  // update url on filter change
  useEffect(() => {
    const newFilter = isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
    const oldFilter = get('salariesFilters');
    if (newFilter !== oldFilter) {
      set('salariesFilters', newFilter);
    }
  }, [filter, get, set]);

  const onSetFilter = useCallback(
    (newFilter: SalariesFilter) => {
      // looks for actual changes before triggering update
      if (!equal(newFilter, filter)) {
        setFilter(newFilter);
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
          <SalariesFiltersForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
          />
        }
        modalSize="xl"
      />
      <ActionIcon variant="default" onClick={(): void => setOpened(true)} size={30}>
        <Filter size={20} />
      </ActionIcon>
    </div>
  );
}
