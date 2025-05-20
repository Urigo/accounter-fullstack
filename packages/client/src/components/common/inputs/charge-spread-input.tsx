import { ReactElement } from 'react';
import { format } from 'date-fns';
import {
  ArrayPath,
  Controller,
  FieldArray,
  FieldValues,
  Path,
  useFieldArray,
  UseFormReturn,
} from 'react-hook-form';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';
import { NumberInput } from '@mantine/core';
import { YearPickerInput } from '@mantine/dates';
import { Button } from '../../ui/button.js';

type Props<T extends FieldValues> = {
  formManager: UseFormReturn<T, unknown>;
  chargeSpreadPath: ArrayPath<T>;
};

export function ChargeSpreadInput<T extends FieldValues>({
  formManager,
  chargeSpreadPath,
}: Props<T>): ReactElement {
  const { control, watch, trigger } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: chargeSpreadPath,
  });

  const watchFieldArray = watch(chargeSpreadPath as Path<T>);
  const controlledFields = fields.map((field, index) => {
    return {
      ...field,
      ...watchFieldArray[index],
    };
  });

  return (
    <div>
      <span className="mantine-InputWrapper-label mantine-Select-label">Charge Spread</span>
      <div className="h-full flex flex-col overflow-hidden">
        {controlledFields?.map((record, index) => (
          <div key={record.id} className="flex items-end gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-xs">
              <Controller
                name={`${chargeSpreadPath}.${index}.year` as Path<T>}
                control={control}
                rules={{
                  required: 'Required',
                  validate: (value: string): boolean | string => {
                    const years = watchFieldArray.map((record: { year: string }) => record.year);
                    if (years.filter((year: string) => year === value).length > 1) {
                      return 'Years must be unique';
                    }
                    return true;
                  },
                }}
                // defaultValue={`${new Date().getFullYear()}-01-01` as PathValue<T, Path<T>>}
                render={({ field: { value, ...field }, fieldState }): ReactElement => {
                  return (
                    <YearPickerInput
                      {...field}
                      label="Year of relevance"
                      value={new Date(value)}
                      error={fieldState.error?.message}
                      popoverProps={{ withinPortal: true }}
                      required
                      onChange={date => {
                        trigger(chargeSpreadPath as Path<T>);
                        field.onChange(date ? format(date, 'yyyy-MM-dd') : undefined);
                      }}
                    />
                  );
                }}
              />
            </div>
            <div className="w-full mt-1 relative rounded-md shadow-xs">
              <Controller
                control={control}
                name={`${chargeSpreadPath}.${index}.amount` as Path<T>}
                render={({ field, fieldState }): ReactElement => (
                  <NumberInput
                    className="w-full"
                    {...field}
                    min={0}
                    label="Amount"
                    value={field.value ?? undefined}
                    hideControls
                    precision={2}
                    error={fieldState.error?.message}
                    onChange={amount =>
                      field.onChange(amount && typeof amount === 'number' ? amount : undefined)
                    }
                  />
                )}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7.5 mb-2"
              onClick={(): void => {
                remove(index);
                trigger(chargeSpreadPath as Path<T>);
              }}
            >
              <TrashX className="size-5" />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="size-7.5"
          onClick={(): void => {
            append({ year: `${new Date().getFullYear()}-01-01` } as FieldArray<T, ArrayPath<T>>);
            trigger(chargeSpreadPath as Path<T>);
          }}
        >
          <PlaylistAdd className="size-5" />
        </Button>
      </div>
    </div>
  );
}
