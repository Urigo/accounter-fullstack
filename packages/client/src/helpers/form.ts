import type { ControllerFieldState } from 'react-hook-form';

export type MakeBoolean<T> =
  T extends Record<string, unknown> ? { [K in keyof T]: MakeBoolean<T[K]> } : boolean | undefined;

/* checks if an object has 'true' value for all keys */
function isTheTruthOutThere(value: unknown): boolean {
  if (typeof value === 'boolean' && value === true) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(v => !!v);
  }
  if (typeof value === 'object') {
    for (const subValue of Object.values(value as Record<string, unknown>)) {
      if (isTheTruthOutThere(subValue)) {
        return true;
      }
    }
  }
  return false;
}

export function relevantDataPicker<T>(
  values: T,
  dirtyFields: MakeBoolean<T> | true,
): Partial<T> | undefined {
  // if no dirty fields, return undefined
  if (!dirtyFields) {
    return undefined;
  }

  // if dirty is plain true, return the entire value
  if (dirtyFields === true && typeof values !== 'object') {
    return values;
  }

  // if dirtyFields is an object, but none of the fields are dirty, return undefined
  // e.g., { field1: false, field2: false } or { field1: { subField1: false } }
  if (!isTheTruthOutThere(dirtyFields)) {
    return undefined;
  }

  if (Array.isArray(values)) {
    return values;
  }

  const keysToHandle = Object.entries(dirtyFields)
    .filter(([_key, value]) => !!value)
    .map(([key, _value]) => key);

  const subset = Object.fromEntries(
    keysToHandle
      .filter(key => key in (values as Record<string, unknown>))
      .map(key => {
        const value = relevantDataPicker(
          values[key as keyof typeof values],
          dirtyFields[key as keyof typeof dirtyFields] as MakeBoolean<T[keyof T]>,
        );
        /* additions to keep entire object instead of subset */
        if (
          [
            'localCurrencyAmount',
            'originalAmount',
            'withholdingTax',
            'vat',
            'tags',
            'amount',
            'defaultIrsCode',
            'irsCode',
          ].includes(key) &&
          value
        ) {
          /* remove unnecessary fields */
          const adjustedValue = values[key as keyof typeof values] as unknown as {
            formatted?: string;
          };
          delete adjustedValue['formatted'];

          return [key, adjustedValue];
        }
        return [key, value];
      }),
  ) as Partial<T>;

  return subset;
}

export function isObjectEmpty(data: Record<string, unknown>): boolean {
  const values = Object.values(data ?? {}).filter(
    value =>
      value !== undefined &&
      (typeof value !== 'object' ||
        (Array.isArray(value)
          ? value.length > 0
          : !isObjectEmpty(value as Record<string, unknown>))),
  );
  return values.length === 0;
}

export function dirtyFieldMarker(fieldState: ControllerFieldState): string {
  return fieldState.isDirty ? 'border-1 border-green-500' : '';
}
