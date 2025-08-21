import { useCallback, useState, type ReactElement } from 'react';
import equal from 'deep-equal';
import { Filter, Loader2 } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Indicator } from '@mantine/core';
import { isObjectEmpty } from '../../../../helpers/index.js';
import { useGetAdminBusinesses } from '../../../../hooks/use-get-admin-businesses.js';
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

export type AnnualAuditFlowFilter = {
  year: number;
  adminBusinessId?: string;
};

export function encodeAnnualAuditFlowFilters(filter?: AnnualAuditFlowFilter | null): string | null {
  return !filter || isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
}

export const ANNUAL_AUDIT_FLOW_FILTERS_QUERY_PARAM = 'annualAuditFlowFilters';

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
  const form = useForm<AnnualAuditFlowFilter>({
    defaultValues: filter,
  });
  const { control, handleSubmit } = form;
  const { selectableAdminBusinesses: adminBusinesses, fetching: adminBusinessesFetching } =
    useGetAdminBusinesses();

  const onSubmit: SubmitHandler<AnnualAuditFlowFilter> = data => {
    setFilter(data);
    closeModal();
  };

  return (
    <>
      {adminBusinessesFetching ? (
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div />
      )}
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
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
            name="adminBusinessId"
            defaultValue={filter?.adminBusinessId}
            control={control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Owner</FormLabel>
                <ComboBox
                  {...field}
                  data={adminBusinesses}
                  value={field.value ?? undefined}
                  disabled={adminBusinessesFetching}
                  placeholder="Select a financial entity"
                  formPart
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button type="submit" disabled={adminBusinessesFetching}>
              Filter
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
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
