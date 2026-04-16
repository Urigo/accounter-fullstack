import { useContext, useEffect, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Indicator, MultiSelect, Select } from '@mantine/core';
import { encodeFilters } from '@/router/routes.js';
import { type BusinessTransactionsFilter } from '../../gql/graphql.js';
import { isObjectEmpty, TIMELESS_DATE_REGEX } from '../../helpers/index.js';
import { useGetBusinesses } from '../../hooks/use-get-businesses.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { UserContext } from '../../providers/user-provider.js';
import { PopUpModal } from '../common/index.js';
import { DatePickerInput } from '../common/inputs/date-picker-input.js';
import { Button } from '../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form.js';

interface BusinessLedgerRecordsFilterFormProps {
  filter: BusinessTransactionsFilter;
  setFilter: (filter: BusinessTransactionsFilter) => void;
  closeModal: () => void;
  single?: boolean;
}

function BusinessLedgerRecordsFilterForm({
  filter,
  setFilter,
  closeModal,
  single = false,
}: BusinessLedgerRecordsFilterFormProps): ReactElement {
  const form = useForm<BusinessTransactionsFilter>({
    defaultValues: { ...filter },
  });
  const { control, handleSubmit } = form;
  const { selectableBusinesses: businesses, fetching: businessesLoading } = useGetBusinesses();

  const { userContext } = useContext(UserContext);

  const onSubmit: SubmitHandler<BusinessTransactionsFilter> = data => {
    setFilter(data);
    closeModal();
  };

  function clearFilter(): void {
    setFilter({
      businessIDs: single ? filter.businessIDs : undefined,
    });
    closeModal();
  }

  return (
    <>
      {businessesLoading ? <div>Loading...</div> : <div />}
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          {!single && (
            <>
              <FormField
                name="ownerIds"
                control={control}
                defaultValue={filter.ownerIds}
                render={({ field, fieldState }): ReactElement => (
                  <FormItem>
                    <FormLabel>Owners</FormLabel>
                    <FormControl>
                      <MultiSelect
                        {...field}
                        data={businesses}
                        value={
                          field.value ??
                          (userContext?.context.adminBusinessId
                            ? [userContext.context.adminBusinessId]
                            : undefined)
                        }
                        disabled={businessesLoading}
                        placeholder="Scroll to see all options"
                        maxDropdownHeight={160}
                        searchable
                        error={fieldState.error?.message}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="businessIDs"
                control={control}
                defaultValue={filter.businessIDs}
                render={({ field, fieldState }): ReactElement => (
                  <FormItem>
                    <FormLabel>Businesses</FormLabel>
                    <FormControl>
                      <MultiSelect
                        {...field}
                        data={businesses}
                        value={field.value ?? undefined}
                        disabled={businessesLoading}
                        placeholder="Scroll to see all options"
                        maxDropdownHeight={160}
                        searchable
                        error={fieldState.error?.message}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
          <FormField
            name="fromDate"
            control={control}
            defaultValue={filter.fromDate}
            rules={{
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be in format yyyy-mm-dd',
              },
            }}
            render={({ field, fieldState }): ReactElement => (
              <FormItem>
                <FormLabel htmlFor="from-date">From Date</FormLabel>
                <FormControl>
                  <DatePickerInput
                    id="from-date"
                    value={field.value ? new Date(field.value) : undefined}
                    onChange={(date?: Date | null): void => {
                      const newDate = date ? format(date, 'yyyy-MM-dd') : undefined;
                      if (newDate !== field.value) field.onChange(newDate);
                    }}
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
                <FormLabel htmlFor="to-date">To Date</FormLabel>
                <FormControl>
                  <DatePickerInput
                    id="to-date"
                    value={field.value ? new Date(field.value) : undefined}
                    onChange={(date?: Date | null): void => {
                      const newDate = date ? format(date, 'yyyy-MM-dd') : undefined;
                      if (newDate !== field.value) field.onChange(newDate);
                    }}
                    aria-invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {!single && (
            <FormField
              name="type"
              control={control}
              defaultValue={null}
              render={({ field, fieldState }): ReactElement => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <Select
                      {...field}
                      onChange={value => field.onChange(value === 'NULL' ? null : value)}
                      data={[
                        { value: 'NULL', label: 'All' },
                        { value: 'BUSINESS', label: 'Business' },
                        { value: 'TAX_CATEGORY', label: 'Tax Category' },
                      ]}
                      error={fieldState.error?.message}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
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

interface BusinessLedgerRecordsFilterProps {
  filter: BusinessTransactionsFilter;
  setFilter: (filter: BusinessTransactionsFilter) => void;
}

export function BusinessLedgerRecordsFilters({
  filter,
  setFilter,
}: BusinessLedgerRecordsFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const [isFiltered, setIsFiltered] = useState(!isObjectEmpty(filter));
  const { get, set } = useUrlQuery();

  function isFilterApplied(filter: BusinessTransactionsFilter): boolean {
    const changed = Object.entries(filter ?? {}).filter(
      ([_key, value]) => value !== undefined && Array.isArray(value) && value.length > 0,
    );
    return changed.length > 0;
  }

  function onSetFilter(newFilter: BusinessTransactionsFilter): void {
    if (newFilter.fromDate?.trim() === '') newFilter.fromDate = undefined;
    if (newFilter.toDate?.trim() === '') newFilter.toDate = undefined;
    // looks for actual changes before triggering update
    if (!equal(newFilter, filter)) {
      setFilter(newFilter);
      setIsFiltered(isFilterApplied(newFilter));
    }
  }

  // update url on filter change
  useEffect(() => {
    const newFilter = encodeFilters(filter);
    const oldFilter = get('ledgerRecordsFilters');
    if (newFilter !== oldFilter) {
      set('ledgerRecordsFilters', newFilter);
    }
  }, [filter, get, set]);

  return (
    <>
      <PopUpModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        content={
          <BusinessLedgerRecordsFilterForm
            single
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
          />
        }
      />
      <Indicator inline size={16} disabled={!isFiltered}>
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={(): void => setOpened(true)}
        >
          <Filter className="size-5" />
        </Button>
      </Indicator>
    </>
  );
}
