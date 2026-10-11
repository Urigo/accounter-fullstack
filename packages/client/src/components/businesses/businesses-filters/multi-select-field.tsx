import type { ReactElement } from 'react';
import { useWatch, type Control } from 'react-hook-form';
import {
  NegatableMultiSelect,
  type NegatableMultiSelectOption,
} from '../../common/inputs/negatable-multi-select.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import type { BusinessesFilterFormValues } from './schema.js';

type MultiSelectName = 'taxCategories' | 'sortCodes' | 'countries';

/** Stable identity for the "nothing selected" case, so it isn't a fresh array per render. */
const EMPTY_LIST: string[] = [];

/**
 * A multi-select bound to the filters form.
 *
 * Renders from `useWatch` rather than the controller's own value: react-hook-form falls back
 * to the value a field mounted with whenever the stored value is `undefined`, which is exactly
 * what a cleared field holds here (an empty list would read as an active filter). See
 * `charges-filters/use-filter-value.ts`.
 */
export function MultiSelectField({
  control,
  name,
  label,
  options,
  loading,
  placeholder,
  searchPlaceholder,
}: {
  control: Control<BusinessesFilterFormValues>;
  name: MultiSelectName;
  label: string;
  options: NegatableMultiSelectOption[];
  loading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
}): ReactElement {
  const value = useWatch({ control, name }) ?? EMPTY_LIST;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }): ReactElement => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <NegatableMultiSelect
              ref={field.ref}
              onBlur={field.onBlur}
              options={options}
              value={value}
              onValueChange={(next): void => field.onChange(next.length ? next : undefined)}
              loading={loading}
              placeholder={placeholder}
              searchPlaceholder={searchPlaceholder}
              aria-label={label}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
