import type { ReactElement } from 'react';
import { useFormContext, type Control } from 'react-hook-form';
import type { TimelessDateString } from '../../../../helpers/dates.js';
import { DatePickerInput } from '../../../common/inputs/date-picker-input.js';
import { Button } from '../../../ui/button.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../ui/form.js';
import { DATE_PRESETS } from '../constants.js';
import type { ChargeFilterFormValues } from '../schema.js';
import { useFilterValue } from '../use-filter-value.js';

export function DateRangeSection({
  control,
}: {
  control: Control<ChargeFilterFormValues>;
}): ReactElement {
  const { setValue } = useFormContext<ChargeFilterFormValues>();
  // Clearing a date — from the picker, the "No range" preset or a header chip — writes
  // `undefined`, which is exactly what makes the controller's own value fall back to
  // whatever the field held when the modal opened.
  const fromAnyDate = useFilterValue(control, 'fromAnyDate') as TimelessDateString | undefined;
  const toAnyDate = useFilterValue(control, 'toAnyDate') as TimelessDateString | undefined;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map(preset => (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-full text-xs font-normal"
            onClick={(): void => {
              const { fromAnyDate, toAnyDate } = preset.range();
              const options = { shouldDirty: true, shouldValidate: true } as const;
              setValue('fromAnyDate', fromAnyDate, options);
              setValue('toAnyDate', toAnyDate, options);
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FormField
          name="fromAnyDate"
          control={control}
          render={({ field, fieldState }): ReactElement => (
            <FormItem className="h-min">
              <FormLabel htmlFor="from-any-date">From Date</FormLabel>
              <FormControl>
                <DatePickerInput
                  id="from-any-date"
                  value={fromAnyDate}
                  onChange={(date): void => {
                    if (date !== fromAnyDate) field.onChange(date ?? undefined);
                  }}
                  aria-invalid={!!fieldState.error}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="toAnyDate"
          control={control}
          render={({ field, fieldState }): ReactElement => (
            <FormItem className="h-min">
              <FormLabel htmlFor="to-any-date">To Date</FormLabel>
              <FormControl>
                <DatePickerInput
                  id="to-any-date"
                  value={toAnyDate}
                  onChange={(date): void => {
                    if (date !== toAnyDate) field.onChange(date ?? undefined);
                  }}
                  aria-invalid={!!fieldState.error}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
