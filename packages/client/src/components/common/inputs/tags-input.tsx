import { ReactElement, useEffect } from 'react';
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
import { useQuery } from 'urql';
import { ActionIcon, Select } from '@mantine/core';
import { AllTagsDocument } from '../../../gql/graphql.js';

type Props<T extends FieldValues> = {
  formManager: UseFormReturn<T, unknown>;
  tagsPath: ArrayPath<T>;
  setFetching?: (fetching: boolean) => void;
};

export function TagsInput<T extends FieldValues>({
  formManager,
  tagsPath,
  setFetching,
}: Props<T>): ReactElement {
  const [{ data, fetching }] = useQuery({
    query: AllTagsDocument,
  });

  const allTags = data?.allTags.map(tag => tag.name) ?? [];

  const { control } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: tagsPath,
    keyName: 'name',
  });

  useEffect(() => {
    if (setFetching) setFetching(fetching);
  }, [fetching, setFetching]);

  return (
    <div>
      <span className="mantine-InputWrapper-label mantine-Select-label">Tags</span>
      <div className="h-full flex flex-col overflow-hidden">
        {fields?.map((tag, index) => (
          <div key={tag.name} className=" flex items-center gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-sm">
              <Controller
                control={control}
                name={`${tagsPath}.${index}.name` as Path<T>}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field, fieldState }): ReactElement => (
                  <Select
                    className="w-full"
                    {...field}
                    data={allTags}
                    value={field.value}
                    disabled={fetching}
                    placeholder="Scroll to see all options"
                    maxDropdownHeight={160}
                    searchable
                    error={fieldState.error?.message}
                    withinPortal
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
          <PlaylistAdd
            size={20}
            onClick={(): void => append({ name: '' } as FieldArray<T, ArrayPath<T>>)}
          />
        </ActionIcon>
      </div>
    </div>
  );
}
