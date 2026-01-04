import { forwardRef, useEffect, type ReactElement } from 'react';
import { Controller, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import { Group, Text } from '@mantine/core';
import { EMPTY_UUID } from '../../../helpers/index.js';
import { useGetTags } from '../../../hooks/use-get-tags.js';
import { ComboBox } from './combo-box.js';

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
        <ComboBox
          {...field}
          data={allTags}
          disabled={fetching}
          placeholder="Scroll to see all options"
          error={fieldState.error?.message}
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
