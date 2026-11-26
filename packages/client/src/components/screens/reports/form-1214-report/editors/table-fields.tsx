import type { ReactElement } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '../../../../ui/form.js';
import { Input } from '../../../../ui/input.js';

/** A text input in a table cell, with its error under it (tied by `aria-describedby`). */
export function TableTextField<T extends FieldValues>({
  control,
  name,
  label,
  inputMode,
  className,
  dir,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  /** The accessible name: a table cell has no visible label. */
  label: string;
  inputMode?: 'numeric' | 'decimal';
  className?: string;
  dir?: 'auto';
}): ReactElement {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }): ReactElement => (
        <FormItem className="gap-1">
          <FormControl>
            <Input
              {...field}
              value={(field.value as string | undefined) ?? ''}
              aria-label={label}
              inputMode={inputMode}
              className={className}
              dir={dir}
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}
