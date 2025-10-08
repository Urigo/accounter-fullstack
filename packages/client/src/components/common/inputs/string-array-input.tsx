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
import { Button } from '../../ui/button.js';
import { FormControl, FormField, FormItem, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';

type Props<T extends FieldValues> = {
  label: string;
  formManager: UseFormReturn<T, unknown>;
  arrayPath: Path<T>;
};

export function StringArrayInput<T extends FieldValues>({
  label,
  formManager,
  arrayPath,
}: Props<T>): ReactElement {
  const { control, watch } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: arrayPath as ArrayPath<T>,
  });

  const watchStringsArray = watch(arrayPath);
  const controlledFields = fields.map((field, index) => {
    return {
      id: field.id,
      ...watchStringsArray[index],
    };
  });

  return (
    <div>
      <span className="mantine-InputWrapper-label mantine-Select-label">{label}</span>
      <div className="h-full flex flex-col overflow-hidden">
        {controlledFields.map((field, index) => (
          <div key={field.id} className=" flex items-center gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-xs">
              <FormField
                name={`${arrayPath}.${index}` as Path<T>}
                control={control}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex w-full max-w-sm items-center gap-2">
                        <Input
                          className="w-full"
                          {...field}
                          value={field.value ?? undefined}
                          required
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7.5"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-5" />
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="size-7.5"
          onClick={() => append(undefined as FieldArray<T>)}
        >
          <ListPlus className="size-5" />
        </Button>
      </div>
    </div>
  );
}
