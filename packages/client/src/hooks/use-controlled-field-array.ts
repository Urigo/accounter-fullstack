import {
  useFieldArray,
  type ArrayPath,
  type FieldArrayPathValue,
  type FieldValues,
  type Path,
  type PathValue,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from 'react-hook-form';

/**
 * Item type of the field array at the given path. Reconstruction of react-hook-form's
 * `FieldArray` type, which is shadowed since v7.82 by the new `FieldArray` component
 * and can no longer be imported from the package root.
 */
export type FieldArrayItem<
  TFieldValues extends FieldValues,
  TPath extends ArrayPath<TFieldValues> = ArrayPath<TFieldValues>,
> =
  FieldArrayPathValue<TFieldValues, TPath> extends ReadonlyArray<infer TItem> | null | undefined
    ? TItem
    : never;

type UseControlledFieldArrayReturn<TFieldValues extends FieldValues> = Pick<
  UseFieldArrayReturn<TFieldValues, ArrayPath<TFieldValues>>,
  'append' | 'remove'
> & {
  controlledFields: UseFieldArrayReturn<TFieldValues, ArrayPath<TFieldValues>>['fields'];
  watchFieldArray: PathValue<TFieldValues, Path<TFieldValues>>;
};

/**
 * Wraps `useFieldArray` and merges the registered fields with the watched values,
 * so consumers render always-current values while keeping stable field ids as keys.
 */
export function useControlledFieldArray<TFieldValues extends FieldValues>(
  formManager: UseFormReturn<TFieldValues, unknown>,
  arrayPath: ArrayPath<TFieldValues>,
): UseControlledFieldArrayReturn<TFieldValues> {
  const { control, watch } = formManager;
  const { fields, append, remove } = useFieldArray({ control, name: arrayPath });

  const watchFieldArray = watch(arrayPath as Path<TFieldValues>);
  const controlledFields = fields.map((field, index) => ({
    ...field,
    ...watchFieldArray?.[index],
  }));

  return { controlledFields, append, remove, watchFieldArray };
}
