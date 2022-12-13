export type MakeBoolean<T> = T extends Record<string, unknown>
  ? { [K in keyof T]: MakeBoolean<T[K]> }
  : boolean | undefined;

/* checks if an object has 'true' value for all keys */
function isTheTruthOutThere(value: unknown) {
  if (typeof value === 'boolean' && value === true) {
    return true;
  }
  if (typeof value === 'object') {
    for (const key in value) {
      if (isTheTruthOutThere((value as Record<string, unknown>)[key])) {
        return true;
      }
    }
  }
  return false;
}

export function relevantDataPicker<T>(values: T, dirtyFields: MakeBoolean<T>) {
  if (!dirtyFields) {
    return undefined;
  }
  if (dirtyFields === true) {
    return values;
  }
  if (typeof dirtyFields === 'object' && !isTheTruthOutThere(dirtyFields)) {
    return undefined;
  }

  const keysToHandle = Object.entries(dirtyFields)
    .filter(([_key, value]) => Boolean(value))
    .map(([key, _value]) => key);

  const subset = Object.fromEntries(
    keysToHandle
      .filter(key => key in (values as Record<string, unknown>))
      .map(key => {
        const value =
          dirtyFields[key as keyof typeof values] === true
            ? values[key as keyof typeof values]
            : relevantDataPicker(
                values[key as keyof typeof values],
                dirtyFields[key as keyof typeof values],
              );
        /* additions to keep entire object instead of subset */
        if (
          [
            'localCurrencyAmount',
            'originalAmount',
            'withholdingTax',
            'beneficiaries',
            'vat',
            'tags',
            'amount',
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
