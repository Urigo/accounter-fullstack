import {
  useFieldArray,
  type ArrayPath,
  type FieldArrayPathValue,
  type FieldValues,
  type Path,
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

type UseControlledFieldArrayReturn<
  TFieldValues extends FieldValues,
  TPath extends ArrayPath<TFieldValues>,
> = Pick<UseFieldArrayReturn<TFieldValues, TPath>, 'append' | 'remove'> & {
  controlledFields: UseFieldArrayReturn<TFieldValues, TPath>['fields'];
  watchFieldArray: FieldArrayItem<TFieldValues, TPath>[];
};

/**
 * Wraps `useFieldArray` and merges the registered fields with the watched values,
 * so consumers render always-current values while keeping stable field ids as keys.
 */
export function useControlledFieldArray<
  TFieldValues extends FieldValues,
  TPath extends ArrayPath<TFieldValues> = ArrayPath<TFieldValues>,
>(
  formManager: UseFormReturn<TFieldValues, unknown>,
  arrayPath: TPath,
): UseControlledFieldArrayReturn<TFieldValues, TPath> {
  const { control, watch } = formManager;
  const { fields, append, remove } = useFieldArray({ control, name: arrayPath });

  const watchFieldArray = (watch(arrayPath as unknown as Path<TFieldValues>) ??
    []) as FieldArrayItem<TFieldValues, TPath>[];

  const controlledFields = fields.map((field, index) => {
    const watchedValue = watchFieldArray[index];
    return {
      ...field,
      ...(typeof watchedValue === 'object' && watchedValue !== null ? watchedValue : {}),
    };
  });

  return { controlledFields, append, remove, watchFieldArray };
}
