import { ReactElement, useEffect, useState } from 'react';
import { format, sub } from 'date-fns';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { ActionIcon, Select, TextInput } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { Currency, IncomeExpenseChartFilters } from '../../../gql/graphql.js';
import { isObjectEmpty, TIMELESS_DATE_REGEX, TimelessDateString } from '../../../helpers/index.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { PopUpModal } from '../../common/index.js';

interface ChartFilterFormProps {
  filter: IncomeExpenseChartFilters;
  setFilter: (filter?: IncomeExpenseChartFilters) => void;
  closeModal: () => void;
}

function ChartFilterForm({ filter, setFilter, closeModal }: ChartFilterFormProps): ReactElement {
  const { handleSubmit, control, trigger } = useForm<IncomeExpenseChartFilters>({
    defaultValues: { ...filter },
  });

  const onSubmit: SubmitHandler<IncomeExpenseChartFilters> = data => {
    setFilter(data);
    closeModal();
  };

  const pastMonth = format(sub(new Date(), { months: 1 }), 'yyyy-MM-dd') as TimelessDateString;
  const pastYear = format(
    sub(new Date(), { years: 1, months: 1 }),
    'yyyy-MM-dd',
  ) as TimelessDateString;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="fromDate"
        control={control}
        defaultValue={pastYear}
        rules={{
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
        }}
        render={({ field, fieldState }): ReactElement => (
          <MonthPickerInput
            {...field}
            label="From Date"
            value={new Date(field.value)}
            onChange={date => {
              trigger('fromDate');
              field.onChange(date ? format(date, 'yyyy-MM-dd') : undefined);
            }}
            error={fieldState.error?.message}
            popoverProps={{ withinPortal: true }}
          />
        )}
      />
      <Controller
        name="toDate"
        control={control}
        defaultValue={pastMonth}
        rules={{
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
        }}
        render={({ field, fieldState }): ReactElement => (
          <MonthPickerInput
            {...field}
            label="To Date"
            value={new Date(field.value)}
            onChange={date => {
              trigger('toDate');
              field.onChange(date ? format(date, 'yyyy-MM-dd') : undefined);
            }}
            error={fieldState.error?.message}
            popoverProps={{ withinPortal: true }}
          />
        )}
      />
      <Controller
        name="currency"
        control={control}
        render={({ field, fieldState }): ReactElement => (
          <Select
            {...field}
            label="Currency"
            defaultValue={Currency.Usd}
            error={fieldState.error?.message}
            data={Object.keys(Currency).map(key => Currency[key as keyof typeof Currency])}
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
  filter: IncomeExpenseChartFilters;
  setFilter: (filter: IncomeExpenseChartFilters) => void;
}

export function ChartFilter({ filter, setFilter }: ChargeFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const { get, set } = useUrlQuery();

  function onSetFilter(newFilter?: IncomeExpenseChartFilters): void {
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
    const oldFilter = get('MonthlyIncomeExpenseChartFilters');
    if (newFilter !== oldFilter) {
      set('MonthlyIncomeExpenseChartFilters', newFilter);
    }
  }, [filter, get, set]);

  return (
    <>
      <PopUpModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        content={
          <ChartFilterForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
          />
        }
      />
      <ActionIcon variant="default" onClick={(): void => setOpened(true)} size={30}>
        <Filter size={20} />
      </ActionIcon>
    </>
  );
}
