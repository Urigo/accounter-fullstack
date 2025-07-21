import { ReactElement } from 'react';
import { ListPlus, Trash2 } from 'lucide-react';
import {
  ArrayPath,
  FieldArray,
  FieldValues,
  Path,
  useFieldArray,
  UseFormReturn,
} from 'react-hook-form';
import { Button } from '../../ui/button.js';
import { FormControl, FormField, FormItem, FormMessage } from '../../ui/form';
import { Input } from '../../ui/input';

type Props<T extends FieldValues> = {
  formManager: UseFormReturn<T, unknown>;
  phrasesPath: Path<T>;
};

export function PhrasesInput<T extends FieldValues>({
  formManager,
  phrasesPath,
}: Props<T>): ReactElement {
  const { control, watch } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: phrasesPath as ArrayPath<T>,
  });

  const watchPhrasesArray = watch(phrasesPath);
  const controlledFields = fields.map((field, index) => {
    return {
      id: field.id,
      ...watchPhrasesArray[index],
    };
  });

  return (
    <div>
      <span className="mantine-InputWrapper-label mantine-Select-label">Phrases</span>
      <div className="h-full flex flex-col overflow-hidden">
        {controlledFields.map((phrase, index) => (
          <div key={phrase.id} className=" flex items-center gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-xs">
              <FormField
                name={`${phrasesPath}.${index}` as Path<T>}
                control={control}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        className="w-full"
                        {...field}
                        value={field.value ?? undefined}
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button variant="ghost" size="icon" className="size-7.5" onClick={() => remove(index)}>
              <Trash2 className="size-5" />
            </Button>
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
