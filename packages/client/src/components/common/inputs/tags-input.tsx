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
import { Select } from '@mantine/core';
import { useGetTags } from '../../../hooks/use-get-tags.js';
import { Button } from '../../ui/button.js';
import { SelectTagItem } from './index.js';

type Props<T extends FieldValues> = {
  formManager: UseFormReturn<T, unknown>;
  tagsPath: ArrayPath<T>;
  setFetching?: (fetching: boolean) => void;
  label?: string;
};

export function TagsInput<T extends FieldValues>({
  formManager,
  tagsPath,
  setFetching,
  label,
}: Props<T>): ReactElement {
  const { selectableTags: allTags, fetching } = useGetTags();

  const { control } = formManager;
  const { fields, append, remove } = useFieldArray({
    control,
    name: tagsPath,
    keyName: 'id',
  });

  useEffect(() => {
    if (setFetching) setFetching(fetching);
  }, [fetching, setFetching]);

  return (
    <div>
      <span className="mantine-InputWrapper-label mantine-Select-label">Tags</span>
      <div className="h-full flex flex-col overflow-hidden">
        {fields?.map((tag, index) => (
          <div key={tag.id} className=" flex items-center gap-2 text-gray-600 mb-2">
            <div className="w-full mt-1 relative rounded-md shadow-xs">
              <Controller
                control={control}
                name={`${tagsPath}.${index}.id` as Path<T>}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field, fieldState }): ReactElement => (
                  <Select
                    className="w-full"
                    {...field}
                    data={allTags}
                    label={label}
                    itemComponent={SelectTagItem}
                    disabled={fetching}
                    placeholder="Scroll to see all options"
                    maxDropdownHeight={160}
                    searchable
                    error={fieldState.error?.message}
                    withinPortal
                    filter={(value, item) =>
                      item.label?.toLowerCase().includes(value.toLowerCase().trim()) ||
                      item.description?.toLowerCase().includes(value.toLowerCase().trim())
                    }
                  />
                )}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7.5"
              onClick={(): void => remove(index)}
            >
              <TrashX className="size-5" />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="size-7.5"
          onClick={(): void => append({} as FieldArray<T, ArrayPath<T>>)}
        >
          <PlaylistAdd className="size-5" />
        </Button>
      </div>
    </div>
  );
}
