import { ReactElement } from 'react';
import { Controller, useFieldArray, UseFormReturn } from 'react-hook-form';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Select } from '@mantine/core';
import { AllTagsDocument, UpdateChargeInput } from '../../../gql/graphql.js';

type Props = {
  formManager: UseFormReturn<UpdateChargeInput, object>;
};

export function TagsInput({ formManager }: Props): ReactElement {
  const [{ data, fetching }] = useQuery({
    query: AllTagsDocument,
  });

  const allTags = data?.allTags.map(tag => tag.name) ?? [];

  const { control } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tags',
    keyName: 'name',
  });

  return (
    <div>
      <div className="h-full flex flex-col overflow-hidden">
        {fields?.map((tag, index) => (
          <div key={tag.name} className=" flex items-center gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-sm">
              <Controller
                control={control}
                name={`tags.${index}.name` as 'tags.0.name'}
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
                    label="Tag"
                    placeholder="Scroll to see all options"
                    maxDropdownHeight={160}
                    searchable
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
          <PlaylistAdd size={20} onClick={(): void => append({ name: '' })} />
        </ActionIcon>
      </div>
    </div>
  );
}
