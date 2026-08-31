import type { ReactElement, ReactNode } from 'react';
import { useController, type Control } from 'react-hook-form';
import type { NegatableMultiSelectOption } from '../../common/inputs/negatable-multi-select.js';
import { NegatableMultiSelect } from '../../common/inputs/negatable-multi-select.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import type { ChargeFilterFormValues } from './schema.js';
import { useFilterValue } from './use-filter-value.js';

/** The include/exclude field pairs the schema supports. */
type NegatableFieldPair =
  | { include: 'byBusinesses'; exclude: 'excludedBusinesses' }
  | { include: 'byFinancialAccounts'; exclude: 'excludedFinancialAccounts' }
  | { include: 'byTags'; exclude: 'excludedTags' };

type SharedProps = {
  control: Control<ChargeFilterFormValues>;
  label: string;
  options: NegatableMultiSelectOption[];
  loading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  groupBy?: (option: NegatableMultiSelectOption) => string | undefined;
  groupOrder?: readonly string[];
  renderOption?: (option: NegatableMultiSelectOption) => ReactNode;
  disabled?: boolean;
};

/** Stable identity for the "nothing selected" case, so it isn't a fresh array per render. */
const EMPTY_LIST: string[] = [];

/**
 * An empty array is not the same as "unset": JSON.stringify keeps `[]` but drops
 * `undefined`, so a stray empty array churns the URL and makes an otherwise empty
 * filter look active. `useFilterValue` is what keeps the cleared field rendering as
 * cleared despite that — see the comment there.
 */
const orUndefined = (values: string[]): string[] | undefined =>
  values.length > 0 ? values : undefined;

/**
 * Drives two form fields from one control. `useController` has to run at the top
 * level for the exclude leg — hooks cannot be called inside a `FormField` render
 * prop, which is invoked as a function rather than mounted as a component. The
 * include leg stays a `FormField` because that is what installs the context
 * `FormLabel` / `FormControl` / `FormMessage` depend on.
 *
 * Both legs render from `useFilterValue` rather than from the controller's own value,
 * which falls back to whatever the field held when the modal opened.
 */
export function NegatableMultiSelectField({
  control,
  include,
  exclude,
  label,
  options,
  loading,
  placeholder,
  searchPlaceholder,
  groupBy,
  groupOrder,
  renderOption,
}: NegatableFieldPair & SharedProps): ReactElement {
  const { field: excluded } = useController({ control, name: exclude });
  const includedValue = useFilterValue(control, include) ?? EMPTY_LIST;
  const excludedValue = useFilterValue(control, exclude) ?? EMPTY_LIST;

  return (
    <FormField
      control={control}
      name={include}
      render={({ field }): ReactElement => (
        <FormItem className="h-min">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <NegatableMultiSelect
              ref={field.ref}
              onBlur={field.onBlur}
              negatable
              options={options}
              value={includedValue}
              onValueChange={(next): void => field.onChange(orUndefined(next))}
              excludedValue={excludedValue}
              onExcludedChange={(next): void => excluded.onChange(orUndefined(next))}
              loading={loading}
              placeholder={placeholder}
              searchPlaceholder={searchPlaceholder}
              groupBy={groupBy}
              groupOrder={groupOrder}
              renderOption={renderOption}
              aria-label={label}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

type PlainField = 'byOwners' | 'byBusinessTrips' | 'byChargeTypes' | 'accountantStatus';

/** The same control without the exclude leg, for fields the backend can't negate. */
export function MultiSelectField({
  control,
  name,
  label,
  options,
  loading,
  placeholder,
  searchPlaceholder,
  renderOption,
  disabled,
}: SharedProps & { name: PlainField }): ReactElement {
  const value = useFilterValue(control, name) ?? EMPTY_LIST;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }): ReactElement => (
        <FormItem className="h-min">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <NegatableMultiSelect
              ref={field.ref}
              onBlur={field.onBlur}
              options={options}
              value={value}
              onValueChange={(next): void => field.onChange(orUndefined(next))}
              loading={loading}
              disabled={disabled}
              placeholder={placeholder}
              searchPlaceholder={searchPlaceholder}
              renderOption={renderOption}
              aria-label={label}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
