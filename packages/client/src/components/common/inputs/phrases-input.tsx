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
  phrasesPath: ArrayPath<T>;
};

export function PhrasesInput<T extends FieldValues>({
  formManager,
  phrasesPath,
}: Props<T>): ReactElement {
  const { control, watch } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: phrasesPath,
  });

  const watchPhrasesArray = watch(phrasesPath as Path<T>);
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
              <Controller
                name={`${phrasesPath}.${index}` as Path<T>}
                control={control}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field, fieldState }): ReactElement => {
                  return (
                    <TextInput
                      className="w-full"
                      {...field}
                      value={field.value ?? undefined}
                      error={fieldState.error?.message}
                      required
                    />
                  );
                }}
              />
            </div>
            <ActionIcon>
              <TrashX size={20} onClick={() => remove(index)} />
            </ActionIcon>
          </div>
        ))}
        <ActionIcon>
          <PlaylistAdd size={20} onClick={() => append(undefined as FieldArray<T>)} />
        </ActionIcon>
      </div>
    </div>
  );
}
