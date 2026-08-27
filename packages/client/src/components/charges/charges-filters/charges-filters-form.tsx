import { useContext, useMemo, type ReactElement } from 'react';
import { RotateCcw } from 'lucide-react';
import { useForm, useWatch, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ChargeFilter } from '../../../gql/graphql.js';
import { UserContext } from '../../../providers/user-provider.js';
import { accountantApprovalOptions } from '../../common/inputs/update-accountant-status.js';
import { Accordion } from '../../ui/accordion.js';
import { Button } from '../../ui/button.js';
import { DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog.js';
import { Form } from '../../ui/form.js';
import { ActiveFilterChips, type ChipLabelSources } from './active-filter-chips.js';
import {
  buildDefaultFormValues,
  buildEmptyFormValues,
  chargeTypeNameOptions,
} from './constants.js';
import {
  countActiveFilters,
  countClassification,
  countCompleteness,
  countDates,
  countEntities,
  type CountableFilter,
} from './counts.js';
import { FilterSection } from './filter-section.js';
import { FreeTextField } from './free-text-field.js';
import {
  chargeFilterFormSchema,
  filterToFormValues,
  formValuesToFilter,
  type ChargeFilterFormValues,
} from './schema.js';
import { ClassificationSection } from './sections/classification-section.js';
import { CompletenessSection } from './sections/completeness-section.js';
import { DateRangeSection } from './sections/date-range-section.js';
import { EntitiesSection, useEntitiesData } from './sections/entities-section.js';
import { SortingSection } from './sections/sorting-section.js';

interface ChargesFiltersFormProps {
  filter: ChargeFilter;
  setFilter: (filter: ChargeFilter) => void;
  closeModal: () => void;
  withDefaultDateRange?: boolean;
}

/** Live "N filters active" line — its own leaf so it doesn't re-render the body. */
function ActiveCountLine(): ReactElement | null {
  const values = useWatch<ChargeFilterFormValues>();
  const count = countActiveFilters(values as CountableFilter);
  if (!count) return null;
  return (
    <DialogDescription>
      {count} filter{count === 1 ? '' : 's'} active
    </DialogDescription>
  );
}

export function ChargesFiltersForm({
  filter,
  setFilter,
  closeModal,
  withDefaultDateRange = true,
}: ChargesFiltersFormProps): ReactElement {
  const { userContext } = useContext(UserContext);
  const data = useEntitiesData();

  const defaultFormValues = useMemo(
    () =>
      buildDefaultFormValues({
        adminBusinessId: userContext?.context.adminBusinessId,
        withDefaultDateRange,
      }),
    [userContext?.context.adminBusinessId, withDefaultDateRange],
  );

  const form = useForm<ChargeFilterFormValues>({
    resolver: zodResolver(chargeFilterFormSchema),
    mode: 'onChange',
    // The form lives inside DialogContent, which Radix unmounts on close, so these
    // are re-derived on every open. Adding `forceMount` above would break that and
    // require an explicit reset-on-open effect instead.
    defaultValues: filterToFormValues(filter, defaultFormValues),
  });
  const { control, handleSubmit } = form;

  const chipSources = useMemo<ChipLabelSources>(
    () => ({
      owners: data.owners,
      businesses: data.financialEntities,
      financialAccounts: data.financialAccounts,
      tags: data.tags,
      businessTrips: data.businessTrips,
      chargeTypes: chargeTypeNameOptions,
      accountantStatus: Object.values(accountantApprovalOptions),
    }),
    [data],
  );

  const onSubmit: SubmitHandler<ChargeFilterFormValues> = values => {
    setFilter(formValuesToFilter(values));
    closeModal();
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader className="shrink-0 space-y-2 border-b px-5 py-4 text-left">
          <div className="space-y-1">
            <DialogTitle>Filter Charges</DialogTitle>
            <ActiveCountLine />
          </div>
          <ActiveFilterChips
            sources={chipSources}
            onClearAll={(): void => form.reset(buildEmptyFormValues())}
          />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <FreeTextField control={control} />

          <Accordion type="multiple" defaultValue={['dates', 'entities', 'classification']}>
            <FilterSection value="dates" label="Date Range" selector={countDates}>
              <DateRangeSection control={control} />
            </FilterSection>

            <FilterSection value="entities" label="Entities" selector={countEntities}>
              <EntitiesSection control={control} data={data} />
            </FilterSection>

            <FilterSection
              value="classification"
              label="Classification"
              selector={countClassification}
            >
              <ClassificationSection control={control} />
            </FilterSection>

            <FilterSection value="completeness" label="Completeness" selector={countCompleteness}>
              <CompletenessSection control={control} />
            </FilterSection>

            <FilterSection value="sort" label="Sorting">
              <SortingSection control={control} />
            </FilterSection>
          </Accordion>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-secondary/30 px-5 py-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(): void => form.reset(defaultFormValues)}
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(): void => form.reset(buildEmptyFormValues())}
            >
              Clear all
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={data.fetching}>
              Apply
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
