import { ActionIcon, ActionIconProps } from '@mantine/core';
import { Check } from 'tabler-icons-react';

export function ConfirmMiniButton(props: ActionIconProps<'button'>) {
  return (
    <ActionIcon variant="hover" color="green" {...props}>
      <Check size={20} />
    </ActionIcon>
  );
}
