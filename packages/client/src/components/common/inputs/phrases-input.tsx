import { ReactElement } from 'react';
import {
  ArrayPath,
  Controller,
  FieldArray,
  FieldValues,
  Path,
  PathValue,
  useFieldArray,
  UseFormReturn,
} from 'react-hook-form';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';
import { ActionIcon, TextInput } from '@mantine/core';

type Props<T extends FieldValues> = {
  formManager: UseFormReturn<T, unknown>;
  phrasesPath: ArrayPath<T>;
  defaultPhrases?: string[];
};

export function PhrasesInput<T extends FieldValues>({
  formManager,
  phrasesPath,
  defaultPhrases,
}: Props<T>): ReactElement {
  const { control } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: phrasesPath,
    keyName: 'phrase',
  });

  // insert predefined default phrases
  defaultPhrases?.map(phrase => append({ phrase } as FieldArray<T, ArrayPath<T>>));

  return (
    <div>
      <span className="mantine-InputWrapper-label mantine-Select-label">Phrases</span>
      <div className="h-full flex flex-col overflow-hidden">
        {fields?.map((phrase, index) => (
          <div key={phrase.phrase} className=" flex items-center gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-sm">
              <Controller
                control={control}
                defaultValue={defaultPhrases?.map(phrase => ({ phrase })) as PathValue<T, Path<T>>}
                name={`${phrasesPath}.${index}.phrase` as Path<T>}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field, fieldState }): ReactElement => (
                  <TextInput className="w-full" {...field} error={fieldState.error?.message} />
                )}
              />
            </div>
            <ActionIcon>
              <TrashX size={20} onClick={(): void => remove(index)} />
            </ActionIcon>
          </div>
        ))}
        <ActionIcon>
          <PlaylistAdd size={20} onClick={(): void => append({} as FieldArray<T, ArrayPath<T>>)} />
        </ActionIcon>
      </div>
    </div>
  );
}
