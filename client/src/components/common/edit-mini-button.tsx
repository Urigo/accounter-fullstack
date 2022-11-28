import { ActionIcon } from '@mantine/core';
import { Edit } from 'tabler-icons-react';

export function EditMiniButton(props: React.ComponentProps<typeof ActionIcon>) {
  return (
    <ActionIcon {...props}>
      <Edit size={20} />
    </ActionIcon>
  );
}
