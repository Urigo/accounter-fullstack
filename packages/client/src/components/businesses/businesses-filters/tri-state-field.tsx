import type { ReactElement } from 'react';
import { useWatch, type Control } from 'react-hook-form';
import { Button } from '../../ui/button.js';
import { FormControl, FormField, FormItem, FormLabel } from '../../ui/form.js';
import type { BusinessesFilterFormValues } from './schema.js';

type TriStateName = 'isClient' | 'isActive' | 'isAdmin';

const OPTIONS: { label: string; value: boolean | undefined }[] = [
  { label: 'Any', value: undefined },
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

/**
 * A yes / no / any segmented control for a boolean filter. "Any" writes `undefined`, i.e. no
 * constraint; "No" writes `false`, which is a real constraint and is kept as one.
 */
export function TriStateField({
  control,
  name,
  label,
}: {
  control: Control<BusinessesFilterFormValues>;
  name: TriStateName;
  label: string;
}): ReactElement {
  // Rendered from `useWatch`, not the controller value, so "Any" (undefined) shows as selected
  // even when the dialog opened on a set value — see MultiSelectField.
  const value = useWatch({ control, name });

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }): ReactElement => (
        <FormItem className="flex flex-row items-center justify-between gap-4 px-3 py-2">
          <FormLabel className="font-normal">{label}</FormLabel>
          <FormControl>
            <div role="group" aria-label={label} className="flex shrink-0 gap-1">
              {OPTIONS.map(option => {
                const active = value === option.value;
                return (
                  <Button
                    key={option.label}
                    type="button"
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    aria-pressed={active}
                    className="w-12"
                    onClick={(): void => field.onChange(option.value)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </FormControl>
        </FormItem>
      )}
    />
  );
}
