import { ReactElement } from 'react';
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
import { ActionIcon, TextInput } from '@mantine/core';

type Props<T extends FieldValues> = {
  formManager: UseFormReturn<T, unknown>;
  flightPathPath: Path<T>;
  flightPathData?: string[];
  fetchingAttendees?: boolean;
};

export function FlightPathInput<T extends FieldValues>({
  formManager,
  flightPathPath,
  flightPathData,
}: Props<T>): ReactElement {
  const { control, watch, trigger } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: flightPathPath as ArrayPath<T>,
  });

  const watchFieldArray = watch(flightPathPath);
  const controlledFields = fields.map((field, index) => {
    return {
      ...field,
      ...watchFieldArray[index],
    };
  });

  if (!flightPathData) {
    return <div>Cannot edit flight path stay, lacking some mandatory information!</div>;
  }

  return (
    <div>
      <span className="mantine-InputWrapper-label mantine-Select-label">Flight Path</span>
      <div className="h-full flex flex-col overflow-hidden">
        {controlledFields?.map((record, index) => (
          <div key={record.id} className="flex items-end gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-xs">
              <Controller
                name={`${flightPathPath}.${index}` as Path<T>}
                control={control}
                rules={{
                  required: 'Required',
                }}
                render={({ field, fieldState }): ReactElement => (
                  <TextInput
                    {...field}
                    value={field.value ?? undefined}
                    placeholder="Destination"
                    error={fieldState.error?.message}
                    required
                  />
                )}
              />
            </div>
            <ActionIcon className="mb-2">
              <TrashX
                size={20}
                onClick={(): void => {
                  remove(index);
                  trigger(flightPathPath);
                }}
              />
            </ActionIcon>
          </div>
        ))}
        <ActionIcon>
          <PlaylistAdd
            size={20}
            onClick={(): void => {
              append({} as FieldArray<T, ArrayPath<T>>);
              trigger(flightPathPath);
            }}
          />
        </ActionIcon>
      </div>
    </div>
  );
}
