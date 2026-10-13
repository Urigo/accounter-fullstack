import type { UseFormReturn } from 'react-hook-form';
import { resetFilterForm } from '../../../helpers/form.js';
import type { BusinessesFilterFormValues } from './schema.js';

/** Unsets every field ("Clear all"); see `resetFilterForm` for why not `form.reset({})`. */
export function clearFilterForm(form: UseFormReturn<BusinessesFilterFormValues>): void {
  resetFilterForm(form, {});
}
