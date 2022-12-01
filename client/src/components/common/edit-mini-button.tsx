import { ActionIcon, ActionIconProps } from '@mantine/core';
import { PolymorphicComponentProps } from '@mantine/utils';
import { Edit } from 'tabler-icons-react';

export function EditMiniButton(props: PolymorphicComponentProps<'button', ActionIconProps>) {
  return (
    <ActionIcon {...props}>
      <Edit size={20} />
    </ActionIcon>
  );
}
