import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from 'react';
import { format, sub } from 'date-fns';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Indicator, MultiSelect, Select, SimpleGrid } from '@mantine/core';
import { encodeFilters } from '@/router/routes.js';
import { ChargeFilterType, ChargeSortByField, type ChargeFilter } from '../../gql/graphql.js';
import type { TimelessDateString } from '../../helpers/dates.js';
import { isObjectEmpty, TIMELESS_DATE_REGEX } from '../../helpers/index.js';
import { useGetFinancialEntities } from '../../hooks/use-get-financial-entities.js';
import { useGetTags } from '../../hooks/use-get-tags.js';
import { useUrlQuery } from '../../hooks/use-url-query.js';
import { UserContext } from '../../providers/user-provider.js';
import {
  accountantApprovalOptions,
  Pagination,
  PopUpModal,
  SelectTagItem,
} from '../common/index.js';
import { DatePickerInput } from '../common/inputs/date-picker-input.js';
import { Button } from '../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Switch } from '../ui/switch.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip.js';

interface ChargesFiltersFormProps {
  filter: ChargeFilter;
  setFilter: (filter: ChargeFilter) => void;
  closeModal: () => void;
}

const fieldsToSort: { label: string; value: ChargeSortByField }[] = [
  {
    value: ChargeSortByField.AbsAmount,
    label: 'Abs Amount',
  },
  {
    value: ChargeSortByField.Amount,
    label: 'Amount',
  },
  {
    value: ChargeSortByField.Date,
    label: 'Date',
  },
];

export const chargesTypeFilterOptions: Array<{ label: string; value: ChargeFilterType }> = [
  { label: 'All', value: ChargeFilterType.All },
  { label: 'Income', value: ChargeFilterType.Income },
  { label: 'Expense', value: ChargeFilterType.Expense },
];

function ChargesFiltersForm({
  filter,
  setFilter,
  closeModal,
}: ChargesFiltersFormProps): ReactElement {
  const { userContext } = useContext(UserContext);
  const form = useForm<ChargeFilter>({
    defaultValues: {
      byOwners: userContext?.context.adminBusinessId
        ? [userContext.context.adminBusinessId]
        : undefined,
      sortBy: {
        field: ChargeSortByField.Date,
        asc: false,
      },
      toAnyDate: format(new Date(), 'yyyy-MM-dd') as TimelessDateString,
      fromAnyDate: format(sub(new Date(), { years: 1 }), 'yyyy-MM-dd') as TimelessDateString,
      ...filter,
    },
  });
  const { control, handleSubmit, watch } = form;
  const [asc, setAsc] = useState(filter.sortBy?.asc ?? false);
  const [enableAsc, setEnableAsc] = useState(!!filter.sortBy?.field);
  const { selectableFinancialEntities: financialEntities, fetching: financialEntitiesFetching } =
    useGetFinancialEntities();
  const { selectableTags: tags, fetching: tagsFetching } = useGetTags();

  const sortByField = watch('sortBy.field');

  useEffect(() => {
    if (sortByField && !enableAsc) {
      setEnableAsc(true);
    } else if (!sortByField && enableAsc) {
      setEnableAsc(false);
    }
  }, [sortByField, enableAsc]);

  const onSubmit: SubmitHandler<ChargeFilter> = data => {
    if (asc != null && data.sortBy?.field) {
      data.sortBy.asc = asc;
    }
    setFilter(data);
    closeModal();
  };

  function clearFilter(): void {
    setFilter({});
    setAsc(false);
    closeModal();
  }

  return (
    <>
      {financialEntitiesFetching ? <div>Loading...</div> : <div />}
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <SimpleGrid cols={2}>
            <FormField
              name="byOwners"
              control={control}
              defaultValue={filter.byOwners}
              render={({ field }): ReactElement => (
                <FormItem className="h-min">
                  <FormLabel>Owners</FormLabel>
                  <FormControl>
                    <MultiSelect
                      {...field}
                      data={financialEntities}
                      value={field.value ?? []}
                      disabled={financialEntitiesFetching}
                      placeholder="Scroll to see all options"
                      maxDropdownHeight={160}
                      searchable
                      withinPortal
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="byBusinesses"
              control={control}
              defaultValue={filter.byBusinesses}
              render={({ field }): ReactElement => (
                <FormItem className="h-min">
                  <FormLabel>Financial Entities</FormLabel>
                  <FormControl>
                    <MultiSelect
                      {...field}
                      data={financialEntities}
                      value={field.value ?? []}
                      disabled={financialEntitiesFetching}
                      placeholder="Scroll to see all options"
                      maxDropdownHeight={160}
                      searchable
                      withinPortal
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="byTags"
              control={control}
              defaultValue={filter.byTags}
              render={({ field }): ReactElement => (
                <FormItem className="h-min">
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <MultiSelect
                      {...field}
                      data={tags}
                      itemComponent={SelectTagItem}
                      value={field.value ?? []}
                      disabled={tagsFetching}
                      placeholder="Scroll to see all options"
                      maxDropdownHeight={160}
                      searchable
                      withinPortal
                      filter={(value, _, item) =>
                        item.label?.toLowerCase().includes(value.toLowerCase().trim()) ||
                        item.description?.toLowerCase().includes(value.toLowerCase().trim())
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="fromAnyDate"
              control={control}
              defaultValue={filter.fromAnyDate}
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
              defaultValue={filter.toAnyDate}
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
            <FormField
              name="chargesType"
              control={control}
              defaultValue={filter.chargesType}
              render={({ field }): ReactElement => (
                <FormItem className="h-min">
                  <FormLabel>Charge Type</FormLabel>
                  <FormControl>
                    <Select
                      {...field}
                      data={chargesTypeFilterOptions}
                      value={field.value ?? ChargeFilterType.All}
                      disabled={financialEntitiesFetching}
                      placeholder="Filter income/expense"
                      maxDropdownHeight={160}
                      withinPortal
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="sortBy.field"
              control={control}
              defaultValue={filter.sortBy?.field ?? ChargeSortByField.Date}
              render={({ field }): ReactElement => (
                <FormItem className="h-min">
                  <FormLabel>Field to sort by</FormLabel>
                  <FormControl>
                    <Select
                      {...field}
                      data={fieldsToSort}
                      placeholder="Scroll to see all options"
                      maxDropdownHeight={160}
                      searchable
                      rightSectionProps={{ style: { width: '5rem' } }}
                      withinPortal
                      rightSection={
                        <div className="flex flex-row items-center gap-1">
                          <Switch
                            defaultChecked={filter.sortBy?.asc ?? false}
                            checked={asc ?? false}
                            disabled={!enableAsc}
                            onCheckedChange={setAsc}
                          />
                          <span className="text-xs">{asc ? 'ASC' : 'DESC'}</span>
                        </div>
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="accountantStatus"
              control={control}
              defaultValue={filter.accountantStatus}
              render={({ field }): ReactElement => (
                <FormItem className="h-min">
                  <FormLabel>Accountant Status</FormLabel>
                  <FormControl>
                    <MultiSelect
                      {...field}
                      value={field.value ?? []}
                      itemComponent={AccountantStatusMultiSelectItem}
                      data={Object.values(accountantApprovalOptions)}
                      disabled={financialEntitiesFetching}
                      placeholder="All"
                      maxDropdownHeight={160}
                      withinPortal
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="freeText"
              control={control}
              rules={{
                minLength: { value: 2, message: 'Must be at least 2 characters' },
              }}
              render={({ field }) => (
                <FormItem className="h-min">
                  <FormLabel>Free Text</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2 mt-4 rounded-lg border p-3 shadow-sm space-y-2">
              <Label>Missing Information:</Label>

              <FormField
                control={form.control}
                name="withoutInvoice"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Without Invoice</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        defaultChecked={filter.withoutInvoice ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="withoutReceipt"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Without Receipts</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        defaultChecked={filter.withoutReceipt ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="withoutDocuments"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Without Documents</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        defaultChecked={filter.withoutDocuments ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="withOpenDocuments"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>With Open Documents</FormLabel>
                    </div>
                    <FormControl>
                      <Tooltip>
                        <TooltipTrigger>
                          <Switch
                            defaultChecked={filter.withOpenDocuments ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Show only charges with documents that are currently open</p>
                        </TooltipContent>
                      </Tooltip>
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="withoutTransactions"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Without Transactions</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        defaultChecked={filter.withoutTransactions ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unbalanced"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Unbalanced businesses</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        defaultChecked={filter.unbalanced ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="withoutLedger"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Without ledger</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        defaultChecked={filter.withoutLedger ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </SimpleGrid>
          <div className="flex justify-center mt-5 gap-3">
            <button
              type="submit"
              disabled={financialEntitiesFetching || tagsFetching}
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

interface ChargesFiltersProps {
  filter?: ChargeFilter;
  setFilter: (filter: ChargeFilter) => void;
  activePage: number;
  totalPages?: number;
  setPage: Dispatch<SetStateAction<number>>;
  initiallyOpened?: boolean;
}

export function ChargesFilters({
  filter = {},
  setFilter,
  activePage,
  setPage,
  totalPages = 1,
  initiallyOpened = false,
}: ChargesFiltersProps): ReactElement {
  const [opened, setOpened] = useState(initiallyOpened);
  const [isFiltered, setIsFiltered] = useState(!isObjectEmpty(filter));
  const { get, set } = useUrlQuery();

  // update url on page change
  useEffect(() => {
    const newPage = activePage > 0 ? activePage.toFixed(0) : null;
    const oldPage = get('page');
    if (newPage !== oldPage) {
      set('page', newPage);
    }
  }, [activePage, get, set]);

  // update url on filter change
  useEffect(() => {
    const newFilter = encodeFilters(filter);
    const oldFilter = get('chargesFilters');
    if (newFilter !== oldFilter) {
      set('chargesFilters', newFilter);
      set('page');
      setPage(0);
    }
  }, [filter, get, set, setPage]);

  const onSetFilter = useCallback(
    (newFilter: ChargeFilter) => {
      // looks for actual changes before triggering update
      if (!equal(newFilter, filter)) {
        setFilter(newFilter);
        setIsFiltered(!isObjectEmpty(newFilter));
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
          <ChargesFiltersForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
          />
        }
        modalSize="xl"
      />
      {totalPages > 1 && (
        <Pagination
          className="flex-fit w-fit mx-0"
          currentPageIndex={activePage}
          onChange={setPage}
          totalPages={totalPages}
        />
      )}
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

type ItemProps = (typeof accountantApprovalOptions)[keyof typeof accountantApprovalOptions];

const AccountantStatusMultiSelectItem = forwardRef<HTMLButtonElement, ItemProps>(
  ({ bgColor, label, color, icon: ApprovalIcon, ...others }: ItemProps, ref) => (
    <Button
      ref={ref}
      {...others}
      variant="ghost"
      size="sm"
      className={`h-7 p-0 ${bgColor}`}
      title={label}
    >
      <ApprovalIcon className={`h-3.5 w-3.5 ${color}`} />
      {label}
    </Button>
  ),
);
AccountantStatusMultiSelectItem.displayName = 'AccountantStatusMultiSelectItem';
