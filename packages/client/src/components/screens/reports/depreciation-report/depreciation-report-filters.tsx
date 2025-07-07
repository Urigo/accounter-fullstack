import { ReactElement, useCallback, useEffect, useState } from 'react';
import equal from 'deep-equal';
import { Filter } from 'lucide-react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { DepreciationReportFilter } from '../../../../gql/graphql.js';
import { isObjectEmpty } from '../../../../helpers/index.js';
import { useGetFinancialEntities } from '../../../../hooks/use-get-financial-entities.js';
import { useUrlQuery } from '../../../../hooks/use-url-query.js';
import { ComboBox, NumberInput } from '../../../common/index.js';
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

export function encodeDepreciationReportFilters(
  filter?: DepreciationReportFilter | null,
): string | null {
  return !filter || isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
}

export const DEPRECIATION_REPORT_FILTERS_QUERY_PARAM = 'depreciationReportFilters';

interface DepreciationReportFiltersFormProps {
  filter: DepreciationReportFilter;
  setFilter: (filter: DepreciationReportFilter) => void;
  close: () => void;
}

function DepreciationReportFiltersForm({
  filter,
  setFilter,
  close,
}: DepreciationReportFiltersFormProps): ReactElement {
  const form = useForm<DepreciationReportFilter>({
    defaultValues: { ...filter },
  });
  const { control, handleSubmit, watch } = form;
  const { selectableFinancialEntities: financialEntities, fetching: financialEntitiesFetching } =
    useGetFinancialEntities();

  const onSubmit: SubmitHandler<DepreciationReportFilter> = data => {
    setFilter({ ...data, year: Number(data.year) });
    close();
  };

  const yearValue = watch('year');
  console.log('yearValue', yearValue, typeof yearValue);

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          name="year"
          control={control}
          rules={{
            required: 'Year is required',
            validate: (value): boolean | string => {
              const year = Number(value);
              return Number.isNaN(year) || year < 2000 || year > 2100 ? 'Invalid year' : true;
            },
          }}
          render={({ field }): ReactElement => (
            <FormItem>
              <FormLabel>Year</FormLabel>
              <FormControl>
                <NumberInput {...field} hideControls decimalScale={0} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="financialEntityId"
          defaultValue={filter?.financialEntityId}
          control={control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Owner</FormLabel>
              <ComboBox
                {...field}
                data={financialEntities}
                value={field.value ?? undefined}
                disabled={financialEntitiesFetching}
                placeholder="Select a financial entity"
                formPart
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={financialEntitiesFetching}>
            Filter
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

interface DepreciationReportFiltersProps {
  filter: DepreciationReportFilter;
  setFilter: (filter: DepreciationReportFilter) => void;
}

export function DepreciationReportFilters({
  filter,
  setFilter,
}: DepreciationReportFiltersProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const { get, set } = useUrlQuery();

  // update url on filter change
  useEffect(() => {
    const newFilter = encodeDepreciationReportFilters(filter);
    const oldFilter = get(DEPRECIATION_REPORT_FILTERS_QUERY_PARAM);
    if (newFilter !== oldFilter) {
      set(DEPRECIATION_REPORT_FILTERS_QUERY_PARAM, newFilter);
    }
  }, [filter, get, set]);

  const onSetFilter = useCallback(
    (newFilter: DepreciationReportFilter) => {
      // looks for actual changes before triggering update
      if (!equal(newFilter, filter)) {
        setFilter(newFilter);
      }
    },
    [filter, setFilter],
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Filter size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DepreciationReportFiltersForm
          filter={filter}
          setFilter={onSetFilter}
          close={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
