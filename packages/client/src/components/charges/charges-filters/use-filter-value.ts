import { useWatch, type Control, type FieldPath, type FieldPathValue } from 'react-hook-form';
import type { ChargeFilterFormValues } from './schema.js';

/**
 * The value a filter field should render.
 *
 * react-hook-form resolves a controller's value as `get(_formValues, name, X)`, where `X`
 * is the value the field held when it mounted — and `get` falls back to `X` whenever the
 * stored value is `undefined`. Every field in this modal clears itself to `undefined`
 * (an empty array is not "unset": it would churn the URL and light up the trigger badge),
 * so a field emptied inside a modal opened on an applied filter re-renders what the modal
 * opened with, while the form state holds nothing — the input shows entities that Apply
 * will not send. `useWatch` without a `defaultValue` carries no such fallback, so cleared
 * renders as cleared. It is also what makes Reset and Clear all, which write the same
 * `undefined`, visibly empty a field.
 *
 * Before the form mounts, `_getWatch` reads `_defaultValues` for a string name, so a
 * filter that was already applied when the modal opened still paints on the first render.
 */
export function useFilterValue<TName extends FieldPath<ChargeFilterFormValues>>(
  control: Control<ChargeFilterFormValues>,
  name: TName,
): FieldPathValue<ChargeFilterFormValues, TName> | undefined {
  return useWatch({ control, name }) as FieldPathValue<ChargeFilterFormValues, TName> | undefined;
}
