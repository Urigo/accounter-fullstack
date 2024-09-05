import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Indicator, MultiSelect, Switch } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { AllFinancialEntitiesDocument, BusinessTransactionsFilter } from '../../../gql/graphql.js';
import { isObjectEmpty, TIMELESS_DATE_REGEX } from '../../../helpers/index.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { UserContext } from '../../../providers/user-provider.js';
import { PopUpModal } from '../../common/index.js';

export type TrialBalanceReportFilters = BusinessTransactionsFilter & {
  isShowZeroedAccounts?: boolean;
};

interface TrialBalanceReportFilterFormProps {
  filter: TrialBalanceReportFilters;
  setFilter: (filter: TrialBalanceReportFilters) => void;
  closeModal: () => void;
}

function TrialBalanceReportFilterForm({
  filter,
  setFilter,
  closeModal,
}: TrialBalanceReportFilterFormProps): ReactElement {
  const [isShowZeroedAccounts, setIsShowZeroedAccounts] = useState<boolean>(false);
  const { control, handleSubmit } = useForm<TrialBalanceReportFilters>({
    defaultValues: { ...filter },
  });
  const [{ data: feData, fetching: feLoading, error: feError }] = useQuery({
    query: AllFinancialEntitiesDocument,
  });

  const { userContext } = useContext(UserContext);

  useEffect(() => {
    if (feError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching financial entities! 🤥',
      });
    }
  }, [feError]);

  const businesses = useMemo(() => {
    return (
      feData?.allFinancialEntities?.nodes
        .map(entity => ({
          value: entity.id,
          label: entity.name,
        }))
        .sort((a, b) => (a.label > b.label ? 1 : -1)) ?? []
    );
  }, [feData]);

  const onSubmit: SubmitHandler<TrialBalanceReportFilters> = data => {
    data.isShowZeroedAccounts = isShowZeroedAccounts ?? false;
    if (data.fromDate?.trim() === '') data.fromDate = undefined;
    if (data.toDate?.trim() === '') data.toDate = undefined;
    setFilter(data);
    closeModal();
  };

  function clearFilter(): void {
    setFilter({});
    closeModal();
  }

  return (
    <>
      {feLoading ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="ownerIds"
          control={control}
          defaultValue={undefined}
          render={({ field, fieldState }): ReactElement => (
            <MultiSelect
              {...field}
              data={businesses}
              value={field.value ?? [userContext?.ownerId]}
              disabled={feLoading}
              label="Owners"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="businessIDs"
          control={control}
          defaultValue={undefined}
          render={({ field, fieldState }): ReactElement => (
            <MultiSelect
              {...field}
              data={businesses}
              value={field.value ?? undefined}
              disabled={feLoading}
              label="Businesses"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="fromDate"
          control={control}
          defaultValue={filter.fromDate}
          rules={{
            required: 'Required',
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
              label="From Date"
              error={fieldState.error?.message}
              required
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
              label="To Date"
              error={fieldState.error?.message}
              required
              popoverProps={{ withinPortal: true }}
            />
          )}
        />
        <Switch
          defaultChecked={filter.isShowZeroedAccounts ?? false}
          onChange={(event): void => setIsShowZeroedAccounts(event.currentTarget.checked)}
          color="gray"
          onLabel={<p>show</p>}
          offLabel={<p>remove</p>}
          label="Show zeroed accounts"
          labelPosition="left"
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

interface TrialBalanceReportFilterProps {
  filter: TrialBalanceReportFilters;
  setFilter: (filter: TrialBalanceReportFilters) => void;
}

export function TrialBalanceReportFilters({
  filter,
  setFilter,
}: TrialBalanceReportFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const [isFiltered, setIsFiltered] = useState(!isObjectEmpty(filter));
  const { get, set } = useUrlQuery();

  function isFilterApplied(filter: TrialBalanceReportFilters): boolean {
    const changed = Object.entries(filter ?? {}).filter(
      ([_key, value]) => value !== undefined && Array.isArray(value) && value.length > 0,
    );
    return changed.length > 0;
  }

  function onSetFilter(newFilter: TrialBalanceReportFilters): void {
    // looks for actual changes before triggering update
    if (!equal(newFilter, filter)) {
      setFilter(newFilter);
      setIsFiltered(isFilterApplied(newFilter));
    }
  }

  // update url on filter change
  useEffect(() => {
    const newFilter = isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
    const oldFilter = get('trialBalanceReportFilters');
    if (newFilter !== oldFilter) {
      set('trialBalanceReportFilters', newFilter);
    }
  }, [filter, get, set]);

  return (
    <>
      <PopUpModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        content={
          <TrialBalanceReportFilterForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
          />
        }
      />
      <Indicator inline size={16} disabled={!isFiltered}>
        <ActionIcon variant="default" onClick={(): void => setOpened(true)} size={30}>
          <Filter size={20} />
        </ActionIcon>
      </Indicator>
    </>
  );
}
