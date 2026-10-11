import {
  useContext,
  useMemo,
  type Dispatch,
  type ReactElement,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useForm, useWatch, type Control, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAllCountries } from '../../../hooks/use-get-countries.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';
import { useGetTaxCategories } from '../../../hooks/use-get-tax-categories.js';
import { UserContext } from '../../../providers/user-provider.js';
import type { NegatableMultiSelectOption } from '../../common/inputs/negatable-multi-select.js';
import { Button } from '../../ui/button.js';
import { DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog.js';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '../../ui/form.js';
import { Switch } from '../../ui/switch.js';
import { clearFilterForm } from './clear-filter-form.js';
import { MultiSelectField } from './multi-select-field.js';
import {
  areFiltersEqual,
  businessesFilterFormSchema,
  countActiveFilters,
  filterToFormValues,
  formValuesToFilter,
  NONE_OPTION_VALUE,
  normalizeBusinessesFilter,
  type BusinessesFilterFormValues,
  type BusinessesPageFilter,
} from './schema.js';
import { TriStateField } from './tri-state-field.js';

interface BusinessesFiltersFormProps {
  filter: BusinessesPageFilter;
  setFilter: Dispatch<SetStateAction<BusinessesPageFilter>>;
  closeModal: () => void;
}

/** Live "N filters active" line — its own leaf so a change doesn't re-render the body. */
function ActiveCountLine(): ReactElement {
  const values = useWatch<BusinessesFilterFormValues>();
  const count = countActiveFilters(formValuesToFilter(values));
  return (
    <DialogDescription>
      {count
        ? `${count} filter${count === 1 ? '' : 's'} active`
        : 'Narrow the businesses directory. Search by name from the toolbar.'}
    </DialogDescription>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function UnusedOnlyField({
  control,
}: {
  control: Control<BusinessesFilterFormValues>;
}): ReactElement {
  // Rendered from `useWatch` so Clear all visibly turns it off — see MultiSelectField.
  const checked = useWatch({ control, name: 'unusedOnly' }) ?? false;

  return (
    <FormField
      control={control}
      name="unusedOnly"
      render={({ field }): ReactElement => (
        <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border px-3 py-2">
          <div className="space-y-0.5">
            <FormLabel className="font-normal">Unused only</FormLabel>
            <FormDescription className="text-xs">
              No transactions, documents, misc expenses or ledger records. Loads usage counts for
              the listed businesses.
            </FormDescription>
          </div>
          <FormControl>
            <Switch
              checked={checked}
              onCheckedChange={(next): void => field.onChange(next || undefined)}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function BusinessesFiltersForm({
  filter,
  setFilter,
  closeModal,
}: BusinessesFiltersFormProps): ReactElement {
  const { userContext } = useContext(UserContext);
  // The option lists load only while the dialog is open: Radix unmounts DialogContent on close.
  const { selectableTaxCategories, fetching: taxCategoriesFetching } = useGetTaxCategories();
  const { sortCodes, fetching: sortCodesFetching } = useGetSortCodes({
    ownerId: userContext?.context.adminBusinessId,
  });
  const { countries, fetching: countriesFetching } = useAllCountries();

  const taxCategoryOptions = useMemo<NegatableMultiSelectOption[]>(
    () => [{ value: NONE_OPTION_VALUE, label: 'No tax category' }, ...selectableTaxCategories],
    [selectableTaxCategories],
  );
  const sortCodeOptions = useMemo<NegatableMultiSelectOption[]>(
    () => [
      { value: NONE_OPTION_VALUE, label: 'No sort code' },
      ...[...sortCodes]
        .sort((a, b) => a.key - b.key)
        .map(sortCode => ({
          value: String(sortCode.key),
          label: sortCode.name ? `${sortCode.key} · ${sortCode.name}` : String(sortCode.key),
        })),
    ],
    [sortCodes],
  );
  const countryOptions = useMemo<NegatableMultiSelectOption[]>(
    () =>
      countries
        .map(country => ({ value: country.code, label: country.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [countries],
  );

  const form = useForm<BusinessesFilterFormValues>({
    resolver: zodResolver(businessesFilterFormSchema),
    // Re-derived on every open, since the form unmounts with the dialog on close.
    defaultValues: filterToFormValues(filter),
  });
  const { control, handleSubmit } = form;

  const onSubmit: SubmitHandler<BusinessesFilterFormValues> = values => {
    setFilter(prev => {
      // The name search belongs to the toolbar; carry it over untouched.
      const next = normalizeBusinessesFilter({ ...formValuesToFilter(values), name: prev.name });
      // Keep the current object when nothing changed, so the query variables stay stable.
      return areFiltersEqual(next, prev) ? prev : next;
    });
    closeModal();
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle>Filter Businesses</DialogTitle>
          <ActiveCountLine />
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <FilterGroup title="Categorization">
            <MultiSelectField
              control={control}
              name="taxCategories"
              label="Tax category"
              options={taxCategoryOptions}
              loading={taxCategoriesFetching}
              placeholder="Any tax category"
              searchPlaceholder="Search tax categories..."
            />
            <MultiSelectField
              control={control}
              name="sortCodes"
              label="Sort code"
              options={sortCodeOptions}
              loading={sortCodesFetching}
              placeholder="Any sort code"
              searchPlaceholder="Search sort codes..."
            />
          </FilterGroup>

          <FilterGroup title="Locality">
            <MultiSelectField
              control={control}
              name="countries"
              label="Country"
              options={countryOptions}
              loading={countriesFetching}
              placeholder="Any country"
              searchPlaceholder="Search countries..."
            />
          </FilterGroup>

          <FilterGroup title="Status">
            <div className="divide-y rounded-lg border">
              <TriStateField control={control} name="isClient" label="Client" />
              <TriStateField control={control} name="isActive" label="Active" />
              <TriStateField control={control} name="isAdmin" label="Admin" />
            </div>
          </FilterGroup>

          <FilterGroup title="Usage">
            <UnusedOnlyField control={control} />
          </FilterGroup>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-secondary/30 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(): void => clearFilterForm(form)}
          >
            Clear all
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
