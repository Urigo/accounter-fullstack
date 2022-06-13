import { ActionIcon, ActionIconProps } from '@mantine/core';
import { Edit } from 'tabler-icons-react';

export function EditMiniButton(props: ActionIconProps<'button'>) {
  return (
    <ActionIcon variant="hover" {...props}>
      <Edit size={20} />
    </ActionIcon>
  );
}
