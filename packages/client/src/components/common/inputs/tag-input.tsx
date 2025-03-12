import { forwardRef, ReactElement, useEffect } from 'react';
import { Controller, FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { Group, Select, Text } from '@mantine/core';
import { EMPTY_UUID } from '../../../helpers/index.js';
import { useGetTags } from '../../../hooks/use-get-tags.js';

type Props<T extends FieldValues> = {
  formManager: UseFormReturn<T, unknown>;
  tagsPath: Path<T>;
  setFetching?: (fetching: boolean) => void;
  label?: string;
  required?: boolean;
};

export function TagInput<T extends FieldValues>({
  formManager,
  tagsPath,
  setFetching,
  label,
  required = false,
}: Props<T>): ReactElement {
  const { selectableTags: allTags, fetching } = useGetTags();
  allTags.push({
    label: 'None',
    value: EMPTY_UUID,
    description: undefined,
  });

  const { control } = formManager;

  useEffect(() => {
    if (setFetching) setFetching(fetching);
  }, [fetching, setFetching]);

  return (
    <Controller
      control={control}
      name={tagsPath as Path<T>}
      rules={{
        required: required ? 'Required' : undefined,
        minLength: { value: 2, message: 'Minimum 2 characters' },
      }}
      render={({ field, fieldState }): ReactElement => (
        <Select
          className="w-full"
          {...field}
          data={allTags}
          label={label}
          itemComponent={SelectTagItem}
          value={field.value}
          disabled={fetching}
          placeholder="Scroll to see all options"
          maxDropdownHeight={160}
          searchable
          error={fieldState.error?.message}
          withinPortal
          allowDeselect={!required}
          filter={(value, item) =>
            item.label?.toLowerCase().includes(value.toLowerCase().trim()) ||
            item.description?.toLowerCase().includes(value.toLowerCase().trim())
          }
        />
      )}
    />
  );
}

interface ItemProps extends React.ComponentPropsWithoutRef<'div'> {
  label: string;
  description?: string;
}

export const SelectTagItem = forwardRef<HTMLDivElement, ItemProps>(
  ({ label, description, ...others }: ItemProps, ref) => (
    <div ref={ref} {...others}>
      <Group noWrap>
        <div>
          {description && (
            <Text size="xs" opacity={0.65}>
              {description}
            </Text>
          )}
          <Text size="sm">{label}</Text>
        </div>
      </Group>
    </div>
  ),
);
SelectTagItem.displayName = 'SelectTagItem';
