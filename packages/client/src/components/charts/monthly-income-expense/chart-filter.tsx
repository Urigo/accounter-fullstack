import { useEffect, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { Select } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { Currency, type IncomeExpenseChartFilters } from '../../../gql/graphql.js';
import {
  isObjectEmpty,
  TIMELESS_DATE_REGEX,
  type TimelessDateString,
} from '../../../helpers/index.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { PopUpModal } from '../../common/index.js';
import { Button } from '../../ui/button.js';

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

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="fromDate"
        control={control}
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
            value={field.value ? new Date(field.value) : null}
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
            value={field.value ? new Date(field.value) : null}
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
      <Button
        variant="outline"
        size="icon"
        className="size-7.5"
        onClick={(): void => setOpened(true)}
      >
        <Filter className="size-5" />
      </Button>
    </>
  );
}
