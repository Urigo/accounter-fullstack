import { useEffect, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { encodeFilters } from '@/router/routes.js';
import type { ChargeFilter } from '../../gql/graphql.js';
import type { TimelessDateString } from '../../helpers/dates.js';
import { TIMELESS_DATE_REGEX } from '../../helpers/index.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { PopUpModal } from '../common/index.js';
import { DatePickerInput } from '../common/inputs/date-picker-input.js';
import { Button } from '../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form.js';

interface ChargeFilterFormProps {
  filter: ChargeFilter;
  setFilter: (filter?: ChargeFilter) => void;
  closeModal: () => void;
}

function ChargeFilterForm({ filter, setFilter, closeModal }: ChargeFilterFormProps): ReactElement {
  const form = useForm<ChargeFilter>({
    defaultValues: { ...filter },
  });
  const { handleSubmit, control } = form;

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
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField
          name="fromAnyDate"
          control={control}
          defaultValue="2023-01-01"
          rules={{
            pattern: {
              value: TIMELESS_DATE_REGEX,
              message: 'Date must be in format yyyy-mm-dd',
            },
          }}
          render={({ field, fieldState }): ReactElement => (
            <FormItem className="h-min">
              <FormLabel htmlFor="from-any-date">From Date</FormLabel>
              <FormControl>
                <DatePickerInput
                  id="from-any-date"
                  value={field.value ?? undefined}
                  onChange={date => {
                    if (date !== field.value) field.onChange(date);
                  }}
                  aria-invalid={!!fieldState.error}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="toAnyDate"
          control={control}
          defaultValue={today}
          rules={{
            pattern: {
              value: TIMELESS_DATE_REGEX,
              message: 'Date must be in format yyyy-mm-dd',
            },
          }}
          render={({ field, fieldState }): ReactElement => (
            <FormItem className="h-min">
              <FormLabel htmlFor="to-any-date">To Date</FormLabel>
              <FormControl>
                <DatePickerInput
                  id="to-any-date"
                  value={field.value ?? undefined}
                  onChange={date => {
                    if (date !== field.value) field.onChange(date);
                  }}
                  aria-invalid={!!fieldState.error}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
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
    </Form>
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
    const newFilter = encodeFilters(filter ?? {});
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
