import { useContext, useEffect, useState, type ReactElement } from 'react';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { encodeFilters } from '@/router/routes.js';
import type { BusinessTransactionsFilter } from '../../../gql/graphql.js';
import { isObjectEmpty, TIMELESS_DATE_REGEX } from '../../../helpers/index.js';
import { useGetAdminBusinesses } from '../../../hooks/use-get-admin-businesses.js';
import { useGetBusinesses } from '../../../hooks/use-get-businesses.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { UserContext } from '../../../providers/user-provider.js';
import { DatePickerInput, PopUpModal } from '../../common/index.js';
import { NegatableMultiSelect } from '../../common/inputs/negatable-multi-select.js';
import { Button } from '../../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Indicator } from '../../ui/indicator.js';
import { Switch } from '../../ui/switch.js';

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
  const { userContext } = useContext(UserContext);
  const form = useForm<TrialBalanceReportFilters>({
    defaultValues: {
      ...filter,
      // Seeded into the form rather than only into the input's `value`: the select
      // rendered the default owner as selected while the form field stayed undefined,
      // so submitting without touching it dropped the owner from the filter.
      ownerIds:
        filter.ownerIds ??
        (userContext?.context.adminBusinessId ? [userContext.context.adminBusinessId] : undefined),
    },
  });
  const { control, handleSubmit } = form;
  const { selectableBusinesses: businesses, fetching: businessesLoading } = useGetBusinesses();
  const {
    selectableAdminBusinesses: owners,
    fetching: ownersLoading,
    soleAdminBusinessId,
  } = useGetAdminBusinesses();

  // A single owner is not a choice: pre-select it so the (disabled) input and the
  // submitted filter agree — a disabled field never fires onChange to sync itself.
  useEffect(() => {
    if (soleAdminBusinessId) {
      form.setValue('ownerIds', [soleAdminBusinessId]);
    }
  }, [soleAdminBusinessId, form]);

  const onSubmit: SubmitHandler<TrialBalanceReportFilters> = data => {
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
      {businessesLoading ? <div>Loading...</div> : <div />}
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
          <FormField
            name="ownerIds"
            control={control}
            defaultValue={undefined}
            render={({ field }): ReactElement => (
              <FormItem>
                <FormLabel>Owners</FormLabel>
                <FormControl>
                  <NegatableMultiSelect
                    ref={field.ref}
                    onBlur={field.onBlur}
                    options={owners}
                    value={soleAdminBusinessId ? [soleAdminBusinessId] : (field.value ?? [])}
                    onValueChange={field.onChange}
                    loading={ownersLoading}
                    disabled={!!soleAdminBusinessId}
                    placeholder="Scroll to see all options"
                    aria-label="Owners"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="businessIDs"
            control={control}
            defaultValue={undefined}
            render={({ field }): ReactElement => (
              <FormItem>
                <FormLabel>Businesses</FormLabel>
                <FormControl>
                  <NegatableMultiSelect
                    ref={field.ref}
                    onBlur={field.onBlur}
                    options={businesses}
                    value={field.value ?? []}
                    onValueChange={field.onChange}
                    loading={businessesLoading}
                    placeholder="Scroll to see all options"
                    aria-label="Businesses"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="fromDate"
            control={control}
            defaultValue={filter.fromDate}
            rules={{
              required: 'Required',
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be in format yyyy-mm-dd',
              },
            }}
            render={({ field, fieldState }): ReactElement => (
              <FormItem>
                <FormLabel htmlFor="trial-balance-from-date">From Date</FormLabel>
                <FormControl>
                  <DatePickerInput
                    id="trial-balance-from-date"
                    onChange={date => {
                      if (date !== field.value) field.onChange(date);
                    }}
                    value={field.value ?? undefined}
                    required
                    aria-invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="toDate"
            control={control}
            defaultValue={filter.toDate}
            rules={{
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be in format yyyy-mm-dd',
              },
            }}
            render={({ field, fieldState }): ReactElement => (
              <FormItem>
                <FormLabel htmlFor="trial-balance-to-date">To Date</FormLabel>
                <FormControl>
                  <DatePickerInput
                    id="trial-balance-to-date"
                    onChange={date => {
                      if (date !== field.value) field.onChange(date);
                    }}
                    value={field.value ?? undefined}
                    required
                    aria-invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="isShowZeroedAccounts"
            control={control}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Show zeroed accounts</FormLabel>
                </div>
                <div className="flex flex-row items-center gap-1">
                  <FormControl>
                    <Switch
                      defaultChecked={filter.isShowZeroedAccounts ?? false}
                      onCheckedChange={field.onChange}
                      checked={field.value === true}
                    />
                  </FormControl>
                  <span>{field.value ? 'show' : 'remove'}</span>
                </div>
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
    const newFilter = encodeFilters(filter);
    const oldFilter = get('trialBalanceReportFilters');
    if (newFilter !== oldFilter) {
      set('trialBalanceReportFilters', newFilter);
    }
  }, [filter, get, set]);

  return (
    <>
      <PopUpModal opened={opened} onClose={(): void => setOpened(false)}>
        <TrialBalanceReportFilterForm
          filter={filter}
          setFilter={onSetFilter}
          closeModal={(): void => setOpened(false)}
        />
      </PopUpModal>
      <Indicator inline size={16} disabled={!isFiltered}>
        <Button variant="outline" onClick={(): void => setOpened(true)} className="p-2">
          <Filter size={20} />
        </Button>
      </Indicator>
    </>
  );
}
