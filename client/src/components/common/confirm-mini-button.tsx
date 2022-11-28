import { ActionIcon } from '@mantine/core';
import { Check } from 'tabler-icons-react';

export function ConfirmMiniButton(props: React.ComponentProps<typeof ActionIcon>) {
  return (
    <ActionIcon color="green" {...props}>
      <Check size={20} />
    </ActionIcon>
  );
}
