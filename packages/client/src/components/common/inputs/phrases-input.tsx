import { ReactElement, useState } from 'react';
import {
  ArrayPath,
  Controller,
  FieldValues,
  Path,
  PathValue,
  UseFormReturn,
} from 'react-hook-form';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';
import { ActionIcon, TextInput } from '@mantine/core';

type Props<T extends FieldValues> = {
  formManager: UseFormReturn<T, unknown>;
  phrasesPath: ArrayPath<T>;
  defaultPhrase?: string;
};

export function PhrasesInput<T extends FieldValues>({
  formManager,
  phrasesPath,
  defaultPhrase,
}: Props<T>): ReactElement {
  const { control, setValue } = formManager;
  const [phrases, setPhrases] = useState<{ ''?: string }[]>(
    defaultPhrase ? [{ '': defaultPhrase }] : [],
  );

  const change = (phrase: string, index: number): void => {
    const list = [...phrases];
    list[index][''] = phrase;
    setPhrases(list);
  };
  const add = (): void => {
    setPhrases([...phrases, {}]);
  };
  const remove = (index: number): void => {
    const list = [...phrases];
    list.splice(index, 1);
    setValue(phrasesPath as Path<T>, list.map(item => item['']) as PathValue<T, Path<T>>);
    setPhrases(list);
  };

  return (
    <div>
      <span className="mantine-InputWrapper-label mantine-Select-label">Phrases</span>
      <div className="h-full flex flex-col overflow-hidden">
        {phrases.map((phrase, index) => (
          <div key={index} className=" flex items-center gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-sm">
              <Controller
                control={control}
                name={`${phrasesPath}.${index}` as Path<T>}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field, fieldState }): ReactElement => (
                  <TextInput
                    className="w-full"
                    {...field}
                    value={phrase['']}
                    onChange={(event): void => {
                      change(event.target.value, index);
                      field.onChange(event.target.value);
                    }}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
            <ActionIcon>
              <TrashX size={20} onClick={(): void => remove(index)} />
            </ActionIcon>
          </div>
        ))}
        <ActionIcon>
          <PlaylistAdd size={20} onClick={add} />
        </ActionIcon>
      </div>
    </div>
  );
}
