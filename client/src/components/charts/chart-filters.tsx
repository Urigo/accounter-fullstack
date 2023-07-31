import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { ActionIcon, TextInput } from '@mantine/core';
import { ChargeFilter } from '../../gql/graphql';
import { TIMELESS_DATE_REGEX } from '../../helpers';
import { TimelessDateString } from '../../helpers/dates';
import { isObjectEmpty } from '../../helpers/form';
import { useUrlQuery } from '../../hooks/use-url-query';
import { PopUpModal } from '../common';

interface ChargeFilterFormProps {
  filter: ChargeFilter;
  setFilter: (filter?: ChargeFilter) => void;
  closeModal: () => void;
}

function ChargeFilterForm({ filter, setFilter, closeModal }: ChargeFilterFormProps) {
  const { handleSubmit, control } = useForm<ChargeFilter>({
    defaultValues: { ...filter },
  });

  const onSubmit: SubmitHandler<ChargeFilter> = data => {
    setFilter(data);
    closeModal();
  };

  function clearFilter() {
    setFilter();
    closeModal();
  }
  const today = format(new Date(), 'yyyy-MM-dd') as TimelessDateString;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="fromDate"
        control={control}
        defaultValue="2023-01-01"
        rules={{
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
        }}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value || ''}
            error={fieldState.error?.message}
            label="From Date"
          />
        )}
      />
      <Controller
        name="toDate"
        control={control}
        defaultValue={today}
        rules={{
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
        }}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value || ''}
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
  );
}

interface ChargeFilterProps {
  filter: ChargeFilter;
  setFilter: (filter: ChargeFilter) => void;
}

export function ChargeFilterFilter({ filter, setFilter }: ChargeFilterProps) {
  const [opened, setOpened] = useState(false);
  const { get, set } = useUrlQuery();

  function onSetFilter(newFilter?: ChargeFilter) {
    newFilter ||= {
      fromDate: format(new Date(), 'yyyy-MM-DD') as TimelessDateString,
      toDate: format(new Date(), 'yyyy-MM-DD') as TimelessDateString,
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
    const oldFilter = get('ChargeMonthlyChartsFilters');
    if (newFilter !== oldFilter) {
      set('ChargeMonthlyChartsFilters', newFilter);
    }
  }, [filter, get, set]);

  return (
    <>
      <PopUpModal
        opened={opened}
        onClose={() => setOpened(false)}
        content={
          <ChargeFilterForm
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
