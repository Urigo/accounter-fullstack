import { useEffect, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { DatePickerInput } from '@mantine/dates';
import type { ChargeFilter } from '../../gql/graphql.js';
import type { TimelessDateString } from '../../helpers/dates.js';
import { isObjectEmpty } from '../../helpers/form.js';
import { TIMELESS_DATE_REGEX } from '../../helpers/index.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { PopUpModal } from '../common/index.js';
import { Button } from '../ui/button.js';

interface ChargeFilterFormProps {
  filter: ChargeFilter;
  setFilter: (filter?: ChargeFilter) => void;
  closeModal: () => void;
}

function ChargeFilterForm({ filter, setFilter, closeModal }: ChargeFilterFormProps): ReactElement {
  const { handleSubmit, control } = useForm<ChargeFilter>({
    defaultValues: { ...filter },
  });

  const onSubmit: SubmitHandler<ChargeFilter> = data => {
    setFilter(data);
    closeModal();
  };

  function clearFilter(): void {
    setFilter();
    closeModal();
  }
  const today = format(new Date(), 'yyyy-MM-dd') as TimelessDateString;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="fromAnyDate"
        control={control}
        defaultValue="2023-01-01"
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
        defaultValue={today}
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
  );
}

interface ChargeFilterProps {
  filter: ChargeFilter;
  setFilter: (filter: ChargeFilter) => void;
}

export function ChargeFilterFilter({ filter, setFilter }: ChargeFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const { get, set } = useUrlQuery();

  function onSetFilter(newFilter?: ChargeFilter): void {
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
        onClose={(): void => setOpened(false)}
        content={
          <ChargeFilterForm
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
