import { useEffect, type ReactElement } from 'react';
import { ListPlus, Trash2 } from 'lucide-react';
import {
  Controller,
  useFieldArray,
  type ArrayPath,
  type FieldArray,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from 'react-hook-form';
import { useGetTags } from '../../../hooks/use-get-tags.js';
import { Button } from '../../ui/button.js';
import { ComboBox } from './combo-box.js';

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
                  <ComboBox
                    {...field}
                    data={allTags}
                    disabled={fetching}
                    placeholder="Scroll to see all options"
                    error={fieldState.error?.message}
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
              <Trash2 className="size-5" />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="size-7.5"
          onClick={(): void => append({} as FieldArray<T, ArrayPath<T>>)}
        >
          <ListPlus className="size-5" />
        </Button>
      </div>
    </div>
  );
}
