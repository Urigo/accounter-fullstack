import { useEffect, useState } from 'react';
import { format, lastDayOfMonth } from 'date-fns';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Select } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { AllFinancialEntitiesDocument, VatReportFilter } from '../../../gql/graphql';
import { isObjectEmpty, TimelessDateString } from '../../../helpers';
import { useUrlQuery } from '../../../hooks/use-url-query';
import { PopUpModal } from '../../common';

interface VatMonthlyReportFilterFormProps {
  filter: VatReportFilter;
  setFilter: (filter?: VatReportFilter) => void;
  closeModal: () => void;
}

function VatMonthlyReportFilterForm({
  filter,
  setFilter,
  closeModal,
}: VatMonthlyReportFilterFormProps) {
  const { control, handleSubmit, setValue } = useForm<VatReportFilter>({
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

  const onSubmit: SubmitHandler<VatReportFilter> = data => {
    setFilter(data);
    closeModal();
  };

  function clearFilter() {
    setFilter();
    closeModal();
  }

  function onSelectDate(date: Date) {
    const from = new Date(date.getFullYear(), date.getMonth(), 1);
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    setValue('fromDate', format(from, 'yyyy-MM-dd') as TimelessDateString);
    setValue('toDate', format(to, 'yyyy-MM-dd') as TimelessDateString);
  }

  return (
    <>
      {feLoading ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="financialEntityId"
          control={control}
          defaultValue={undefined}
          render={({ field, fieldState }) => (
            <Select
              {...field}
              data={
                feData?.allFinancialEntities.map(entity => ({
                  value: entity.id,
                  label: entity.name,
                })) ?? []
              }
              value={field.value}
              disabled={feLoading}
              label="Financial Entities"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
            />
          )}
        />
        <DatePicker
          placeholder="Pick month"
          label="Report Month"
          inputFormat="MM/YYYY"
          labelFormat="MM/YYYY"
          defaultValue={filter?.fromDate ? new Date(filter.fromDate) : new Date()}
          initialLevel="month"
          onChange={onSelectDate}
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

interface VatMonthlyReportFilterProps {
  filter: VatReportFilter;
  setFilter: (filter: VatReportFilter) => void;
}

export function VatMonthlyReportFilter({ filter, setFilter }: VatMonthlyReportFilterProps) {
  const [opened, setOpened] = useState(false);
  const { get, set } = useUrlQuery();

  function onSetFilter(newFilter?: VatReportFilter) {
    newFilter ||= {
      financialEntityId: '6a20aa69-57ff-446e-8d6a-1e96d095e988',
      fromDate: format(new Date(), 'yyyy-MM-01') as TimelessDateString,
      toDate: format(lastDayOfMonth(new Date()), 'yyyy-MM-dd') as TimelessDateString,
    };
    // looks for actual changes before triggering update
    if (!equal(newFilter, filter)) {
      setFilter(newFilter);
    }
  }

  // update url on filter change
  useEffect(() => {
    const newFilter = isObjectEmpty(filter ?? {})
      ? null
      : encodeURIComponent(JSON.stringify(filter));
    const oldFilter = get('vatMonthlyReportFilters');
    if (newFilter !== oldFilter) {
      set('vatMonthlyReportFilters', newFilter);
    }
  }, [filter, get, set]);

  return (
    <>
      <PopUpModal
        opened={opened}
        onClose={() => setOpened(false)}
        content={
          <VatMonthlyReportFilterForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={() => setOpened(false)}
          />
        }
      />
      <ActionIcon variant="default" onClick={() => setOpened(true)} size={30}>
        <Filter size={20} />
      </ActionIcon>
    </>
  );
}
