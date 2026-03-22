import { useCallback, useState, type ReactElement } from 'react';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Indicator } from '@mantine/core';
import { isObjectEmpty } from '../../../../helpers/index.js';
import { Button } from '../../../ui/button.js';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '../../../ui/dialog.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';

export type AnnualAuditFlowFilter = {
  year: number;
};

export function encodeAnnualAuditFlowFilters(filter?: AnnualAuditFlowFilter | null): string | null {
  return !filter || isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
}

export const ANNUAL_AUDIT_FLOW_FILTERS_QUERY_PARAM = 'annualAuditFlowFilters';

const MIN_YEAR = 2000;
const MAX_YEAR = new Date().getFullYear();

function clampYear(year: number): number {
  return Math.min(Math.max(year, MIN_YEAR), MAX_YEAR);
}

interface YearPickerProps {
  value?: number;
  onChange: (value: number) => void;
}

function YearPicker({ value, onChange }: YearPickerProps): ReactElement {
  const selectedYear = typeof value === 'number' ? clampYear(value) : undefined;
  const availableYears = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, index) =>
    String(MAX_YEAR - index),
  );

  return (
    <Select
      value={selectedYear ? String(selectedYear) : undefined}
      onValueChange={year => onChange(Number(year))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={`Select year (${MIN_YEAR}-${MAX_YEAR})`} />
      </SelectTrigger>
      <SelectContent>
        {availableYears.map(year => (
          <SelectItem key={year} value={year}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface AnnualAuditFlowFiltersFormProps {
  filter: AnnualAuditFlowFilter;
  setFilter: (filter: AnnualAuditFlowFilter) => void;
  closeModal: () => void;
}

function AnnualAuditFlowFiltersForm({
  filter,
  setFilter,
  closeModal,
}: AnnualAuditFlowFiltersFormProps): ReactElement {
  const normalizedFilter: AnnualAuditFlowFilter = {
    ...filter,
    year: clampYear(filter.year),
  };

  const form = useForm<AnnualAuditFlowFilter>({
    defaultValues: normalizedFilter,
  });
  const { control, handleSubmit } = form;

  const onSubmit: SubmitHandler<AnnualAuditFlowFilter> = data => {
    setFilter(data);
    closeModal();
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField
          name="year"
          control={control}
          rules={{
            required: 'Year is required',
            validate: (value): boolean | string => {
              const year = Number(value);
              return Number.isNaN(year) || year < MIN_YEAR || year > MAX_YEAR
                ? `Year must be between ${MIN_YEAR} and ${MAX_YEAR}`
                : true;
            },
          }}
          render={({ field }): ReactElement => (
            <FormItem>
              <FormLabel>Year</FormLabel>
              <FormControl>
                <YearPicker value={Number(field.value)} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit">Filter</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

interface AnnualAuditFlowFiltersProps {
  filter: AnnualAuditFlowFilter;
  setFilter: (filter: AnnualAuditFlowFilter) => void;
}

export function AnnualAuditFlowFilters({
  filter,
  setFilter,
}: AnnualAuditFlowFiltersProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const [isFiltered, setIsFiltered] = useState(!isObjectEmpty(filter));

  const onSetFilter = useCallback(
    (newFilter: AnnualAuditFlowFilter) => {
      // looks for actual changes before triggering update
      if (!equal(newFilter, filter)) {
        setFilter(newFilter);
        setIsFiltered(!isObjectEmpty(newFilter));
      }
    },
    [filter, setFilter],
  );

  return (
    <Dialog open={opened} onOpenChange={setOpened}>
      <DialogTrigger asChild>
        <Indicator inline size={16} disabled={!isFiltered}>
          <Button variant="outline" size="icon">
            <Filter size={20} />
          </Button>
        </Indicator>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <AnnualAuditFlowFiltersForm
          filter={filter}
          setFilter={onSetFilter}
          closeModal={(): void => setOpened(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
