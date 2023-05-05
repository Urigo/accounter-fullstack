import { Controller, useFieldArray, UseFormReturn } from 'react-hook-form';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Select } from '@mantine/core';
import { AllTagsDocument, UpdateChargeInput } from '../../../gql/graphql';

/* GraphQL */ `
  query AllTags {
    allTags {
      name
    }
  }
`;

type Props = {
  label?: string;
  formManager: UseFormReturn<UpdateChargeInput, object>;
};

export function TagsInput({ label, formManager }: Props) {
  const [{ data, fetching }] = useQuery({
    query: AllTagsDocument,
  });

  const allTags = data?.allTags.map(tag => tag.name) ?? [];

  const { control } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tags',
    rules: { maxLength: 1 },
  });

  return (
    <div>
      <label className="block text-sm pb-1 font-medium text-gray-700">{label ?? 'Tags'}</label>
      <span>Currently adjusted to </span>
      <div className="h-full flex flex-col overflow-hidden">
        {fields?.map((tag, index) => (
          <div key={String(tag.id)} className=" flex items-center gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-sm">
              <Controller
                control={control}
                name={`tags.${index}.name`}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field, fieldState }) => (
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
              <TrashX size={20} onClick={() => remove(index)} />
            </ActionIcon>
          </div>
        ))}
        <ActionIcon>
          <PlaylistAdd size={20} onClick={() => append({ name: '' })} />
        </ActionIcon>
        {fields.length > 1 && (
          <p className="text-red-500 text-xs italic">Currently adjusted to accept only one tag</p>
        )}
      </div>
    </div>
  );
}
