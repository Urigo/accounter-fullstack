import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Indicator, SimpleGrid } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useGetAdminBusinesses } from '@/hooks/use-get-admin-businesses.js';
import type { BalanceReportScreenQueryVariables } from '../../../../gql/graphql.js';
import { isObjectEmpty, TIMELESS_DATE_REGEX } from '../../../../helpers/index.js';
import { useGetFinancialEntities } from '../../../../hooks/use-get-financial-entities.js';
import { useGetTags } from '../../../../hooks/use-get-tags.js';
import { useUrlQuery } from '../../../../hooks/use-url-query.js';
import { ComboBox, MultiSelect, PopUpModal } from '../../../common/index.js';
import { Button } from '../../../ui/button.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form.js';

export function encodeBalanceReportFilters(filter?: BalanceReportFilter | null): string | null {
  return !filter || isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
}

export const BALANCE_REPORT_FILTERS_QUERY_PARAM = 'balanceReportFilters';

export const Periods = {
  MONTHLY: 'Monthly',
  BI_MONTHLY: 'Bi-monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUALLY: 'Semi-Annually',
  ANNUALLY: 'Annually',
} as const;

export type Period = (typeof Periods)[keyof typeof Periods];

const balanceReportFilterSchema = z.object({
  ownerId: z.string().optional(),
  fromDate: z.string().regex(TIMELESS_DATE_REGEX, 'Date must be in format yyyy-mm-dd'),
  toDate: z.string().regex(TIMELESS_DATE_REGEX, 'Date must be in format yyyy-mm-dd'),
  period: z.enum([
    Periods.MONTHLY,
    Periods.BI_MONTHLY,
    Periods.QUARTERLY,
    Periods.SEMI_ANNUALLY,
    Periods.ANNUALLY,
  ]),
  excludedCounterparties: z.array(z.string()),
  includedTags: z.array(z.string()),
  excludedTags: z.array(z.string()),
});

type BalanceReportFilterFormValues = z.infer<typeof balanceReportFilterSchema>;

export type BalanceReportFilter = BalanceReportScreenQueryVariables & {
  period: Period;
  excludedCounterparties: string[];
  includedTags: string[];
  excludedTags: string[];
};

function filterToFormValues(filter: BalanceReportFilter): BalanceReportFilterFormValues {
  return {
    ownerId: filter.ownerId ?? undefined,
    fromDate: filter.fromDate,
    toDate: filter.toDate,
    period: filter.period ?? Periods.MONTHLY,
    excludedCounterparties: filter.excludedCounterparties ?? [],
    includedTags: filter.includedTags ?? [],
    excludedTags: filter.excludedTags ?? [],
  };
}

interface BalanceReportFiltersFormProps {
  filter: BalanceReportFilter;
  setFilter: (filter: BalanceReportFilter) => void;
  closeModal: () => void;
}

function BalanceReportFiltersForm({
  filter,
  setFilter,
  closeModal,
}: BalanceReportFiltersFormProps): ReactElement {
  const form = useForm<BalanceReportFilterFormValues>({
    resolver: zodResolver(balanceReportFilterSchema),
    defaultValues: filterToFormValues(filter),
  });

  const { selectableAdminBusinesses: adminBusinesses, fetching: fetchingAdminBusinesses } =
    useGetAdminBusinesses();
  const { selectableFinancialEntities: financialEntities, fetching: financialEntitiesFetching } =
    useGetFinancialEntities();
  const { selectableTags: allTags, fetching: tagsFetching } = useGetTags();

  const onSubmit: SubmitHandler<BalanceReportFilterFormValues> = data => {
    setFilter(data as BalanceReportFilter);
    closeModal();
  };

  const excludedTags = form.watch('excludedTags');
  const selectableIncludedTags = useMemo(
    () => allTags.filter(tag => !excludedTags.includes(tag.value)),
    [excludedTags, allTags],
  );

  const includedTags = form.watch('includedTags');
  const selectableExcludedTags = useMemo(
    () => allTags.filter(tag => !includedTags.includes(tag.value)),
    [includedTags, allTags],
  );
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <SimpleGrid cols={2}>
          <FormField
            control={form.control}
            name="ownerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Admin Business</FormLabel>
                <FormControl>
                  <ComboBox
                    onChange={field.onChange}
                    data={adminBusinesses}
                    value={field.value}
                    disabled={fetchingAdminBusinesses}
                    placeholder="Scroll to see all options"
                    formPart
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fromDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From Date</FormLabel>
                <FormControl>
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
                    popoverProps={{ withinPortal: true }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="toDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To Date</FormLabel>
                <FormControl>
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
                    popoverProps={{ withinPortal: true }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="period"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period</FormLabel>
                <FormControl>
                  <ComboBox
                    onChange={field.onChange}
                    data={Object.values(Periods).map(period => ({ value: period, label: period }))}
                    value={field.value}
                    placeholder="Select period"
                    formPart
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="excludedCounterparties"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Excluded Counterparties</FormLabel>
                <FormControl>
                  <MultiSelect
                    asChild
                    options={financialEntities}
                    onValueChange={field.onChange}
                    defaultValue={field.value ?? []}
                    value={field.value ?? []}
                    placeholder="Scroll to see all options"
                    variant="default"
                    disabled={financialEntitiesFetching}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="includedTags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Included Tags</FormLabel>
                <FormControl>
                  <MultiSelect
                    asChild
                    options={selectableIncludedTags}
                    onValueChange={field.onChange}
                    defaultValue={field.value ?? []}
                    value={field.value ?? []}
                    placeholder="Scroll to see all options"
                    variant="default"
                    disabled={tagsFetching}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="excludedTags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Excluded Tags</FormLabel>
                <FormControl>
                  <MultiSelect
                    asChild
                    options={selectableExcludedTags}
                    onValueChange={field.onChange}
                    defaultValue={field.value ?? []}
                    value={field.value ?? []}
                    placeholder="Scroll to see all options"
                    variant="default"
                    disabled={tagsFetching}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SimpleGrid>
        <div className="flex justify-center mt-5 gap-3">
          <Button type="submit" disabled={fetchingAdminBusinesses}>
            Filter
          </Button>
          <Button type="button" variant="destructive" onClick={closeModal}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface BalanceReportFiltersProps {
  filter: BalanceReportFilter;
  setFilter: (filter: BalanceReportFilter) => void;
  initiallyOpened?: boolean;
}

export function BalanceReportFilters({
  filter,
  setFilter,
  initiallyOpened = false,
}: BalanceReportFiltersProps): ReactElement {
  const [opened, setOpened] = useState(initiallyOpened);
  const [isFiltered, setIsFiltered] = useState(!!filter);
  const { get, set } = useUrlQuery();

  // update url on filter change
  useEffect(() => {
    const newFilter = encodeBalanceReportFilters(filter);
    const oldFilter = get(BALANCE_REPORT_FILTERS_QUERY_PARAM);
    if (newFilter !== oldFilter) {
      set(BALANCE_REPORT_FILTERS_QUERY_PARAM, newFilter);
    }
  }, [filter, get, set]);

  const onSetFilter = useCallback(
    (newFilter: BalanceReportFilter) => {
      // looks for actual changes before triggering update
      if (!equal(newFilter, filter)) {
        setFilter(newFilter);
        setIsFiltered(!!newFilter);
      }
    },
    [filter, setFilter],
  );

  return (
    <div className="flex flex-row gap-5 items-center">
      <PopUpModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        content={
          <BalanceReportFiltersForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
          />
        }
        modalSize="xl"
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
    </div>
  );
}
