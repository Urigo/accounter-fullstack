import type { ReactElement } from 'react';
import { ListPlus, Trash2 } from 'lucide-react';
import {
  useFieldArray,
  type ArrayPath,
  type FieldArray,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from 'react-hook-form';
import { Button } from '../../../ui/button.js';
import { FormControl, FormField, FormItem, FormMessage } from '../../../ui/form';
import { Input } from '../../../ui/input';

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
              <FormField
                name={`${flightPathPath}.${index}` as Path<T>}
                control={control}
                rules={{
                  required: 'Required',
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? undefined}
                        placeholder="Destination"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="mb-2 size-7.5"
              onClick={(): void => {
                remove(index);
                trigger(flightPathPath);
              }}
            >
              <Trash2 className="size-5" />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="size-7.5"
          onClick={(): void => {
            append('' as FieldArray<T, ArrayPath<T>>);
            trigger(flightPathPath);
          }}
        >
          <ListPlus className="size-5" />
        </Button>
      </div>
    </div>
  );
}
