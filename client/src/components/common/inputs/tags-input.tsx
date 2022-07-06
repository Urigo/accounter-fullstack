import { ActionIcon } from '@mantine/core';
import { Controller, useFieldArray, UseFormReturn } from 'react-hook-form';
import { PlaylistAdd, TrashX } from 'tabler-icons-react';

import { UpdateChargeInput } from '../../../__generated__/types';
import { TextInput } from './text-input';

type Props = {
  label?: string;
  formManager: UseFormReturn<UpdateChargeInput, object>;
};

export function TagsInput({ label, formManager }: Props) {
  const { control } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tags',
  });

  return (
    <div>
      {!label && <label className="block text-sm pb-1 font-medium text-gray-700">{label ?? 'Tags'}</label>}
      <div className="h-full flex flex-col relative overflow-hidden">
        {fields?.map((tag, index) => (
          <div key={`${tag.id}`} className="flex items-center gap-2 text-gray-600 mb-2">
            <div className="mt-1 relative rounded-md shadow-sm">
              <Controller
                control={control}
                name={`tags.${index}.name`}
                rules={{ required: 'Required', minLength: { value: 2, message: 'Minimum 2 characters' } }}
                render={({ field, fieldState }) => <TextInput {...field} error={fieldState.error?.message} />}
              />
            </div>
            <ActionIcon variant="hover">
              <TrashX size={20} onClick={() => remove(index)} />
            </ActionIcon>
          </div>
        ))}
      </div>

      <ActionIcon variant="hover">
        <PlaylistAdd size={20} onClick={() => append({ name: '' })} />
      </ActionIcon>
    </div>
  );
}
