import { format } from 'date-fns';

/**
 * Normalizes a salary month input to `yyyy-MM`.
 *
 * A `yyyy-mm…` value (e.g. a `yyyy-mm-dd` date) is cut to its month as is: parsing it with
 * `new Date()` would read it as UTC midnight, which is still the previous month west of UTC.
 */
export function normalizeSalaryMonth(month: string): string {
  if (month.length === 7) {
    return month;
  }
  if (/^\d{4}-\d{2}(?:-|$)/.test(month)) {
    return month.slice(0, 7);
  }
  return format(new Date(month), 'yyyy-MM');
}
