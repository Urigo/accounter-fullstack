import { useContext, useEffect, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { Select } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { ChargeFilterType, type VatReportFilter } from '../../../gql/graphql.js';
import { isObjectEmpty, type TimelessDateString } from '../../../helpers/index.js';
import { useGetFinancialEntities } from '../../../hooks/use-get-financial-entities.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { UserContext } from '../../../providers/user-provider.js';
import { chargesTypeFilterOptions } from '../../charges/charges-filters.js';
import { PopUpModal } from '../../common/index.js';
import { Button } from '../../ui/button.js';

interface VatMonthlyReportFilterFormProps {
  filter: VatReportFilter;
  setFilter: (filter?: VatReportFilter) => void;
  closeModal: () => void;
}

function VatMonthlyReportFilterForm({
  filter,
  setFilter,
  closeModal,
}: VatMonthlyReportFilterFormProps): ReactElement {
  const { control, handleSubmit, setValue } = useForm<VatReportFilter>({
    defaultValues: { ...filter },
  });
  const { selectableFinancialEntities: financialEntities, fetching: feLoading } =
    useGetFinancialEntities();

  const onSubmit: SubmitHandler<VatReportFilter> = data => {
    setFilter(data);
    closeModal();
  };

  function clearFilter(): void {
    setFilter();
    closeModal();
  }

  function onSelectDate(date: Date): void {
    const month = new Date(date.getFullYear(), date.getMonth(), 15);
    setValue('monthDate', format(month, 'yyyy-MM-dd') as TimelessDateString);
  }

  return (
    <>
      {feLoading ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="financialEntityId"
          control={control}
          defaultValue={undefined}
          render={({ field, fieldState }): ReactElement => (
            <Select
              {...field}
              data={financialEntities}
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
        <Controller
          name="chargesType"
          control={control}
          defaultValue={filter.chargesType}
          render={({ field, fieldState }): ReactElement => (
            <Select
              {...field}
              data={chargesTypeFilterOptions}
              value={field.value ?? ChargeFilterType.All}
              label="Charge Type"
              placeholder="Filter income/expense"
              maxDropdownHeight={160}
              error={fieldState.error?.message}
            />
          )}
        />
        <MonthPickerInput
          defaultValue={filter?.monthDate ? new Date(filter.monthDate) : new Date()}
          defaultDate={filter?.monthDate ? new Date(filter.monthDate) : new Date()}
          onChange={onSelectDate}
          popoverProps={{ withinPortal: true }}
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
    </>
  );
}

interface VatMonthlyReportFilterProps {
  filter: VatReportFilter;
  setFilter: (filter: VatReportFilter) => void;
}

export function VatMonthlyReportFilter({
  filter,
  setFilter,
}: VatMonthlyReportFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const { get, set } = useUrlQuery();

  const { userContext } = useContext(UserContext);

  function onSetFilter(newFilter?: VatReportFilter): void {
    newFilter ||= {
      financialEntityId: userContext?.context.adminBusinessId ?? filter.financialEntityId,
      monthDate: format(new Date(), 'yyyy-MM-15') as TimelessDateString,
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
        onClose={(): void => setOpened(false)}
        content={
          <VatMonthlyReportFilterForm
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
