import type { ReactElement } from 'react';
import { useFormContext, type Control } from 'react-hook-form';
import type { TimelessDateString } from '../../../../helpers/dates.js';
import { DatePickerInput } from '../../../common/inputs/date-picker-input.js';
import { Button } from '../../../ui/button.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../ui/form.js';
import { DATE_PRESETS } from '../constants.js';
import type { ChargeFilterFormValues } from '../schema.js';

export function DateRangeSection({
  control,
}: {
  control: Control<ChargeFilterFormValues>;
}): ReactElement {
  const { setValue } = useFormContext<ChargeFilterFormValues>();

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
                  value={(field.value ?? undefined) as TimelessDateString | undefined}
                  onChange={(date): void => {
                    if (date !== field.value) field.onChange(date ?? undefined);
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
                  value={(field.value ?? undefined) as TimelessDateString | undefined}
                  onChange={(date): void => {
                    if (date !== field.value) field.onChange(date ?? undefined);
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
