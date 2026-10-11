import type { UseFormReturn } from 'react-hook-form';
import type { BusinessesFilterFormValues } from './schema.js';

const FORM_FIELDS = [
  'taxCategories',
  'sortCodes',
  'countries',
  'isClient',
  'isActive',
  'isAdmin',
  'unusedOnly',
] as const satisfies readonly (keyof BusinessesFilterFormValues)[];

/**
 * Unsets every field ("Clear all").
 *
 * Not `form.reset({})`: a reset drops the registered fields, and each controller re-registers
 * with the value it held when the dialog opened — so on a dialog opened over an applied filter,
 * the cleared values silently come back and Apply re-sends them. Unsetting field by field keeps
 * the registrations, and with them the cleared state.
 */
export function clearFilterForm(form: UseFormReturn<BusinessesFilterFormValues>): void {
  for (const field of FORM_FIELDS) {
    form.setValue(field, undefined, { shouldDirty: true });
  }
}
