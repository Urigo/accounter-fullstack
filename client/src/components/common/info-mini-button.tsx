import { ActionIcon, ActionIconProps } from '@mantine/core';
import { InfoCircle } from 'tabler-icons-react';

export function InfoMiniButton(props: ActionIconProps<'button'>) {
  return (
    <ActionIcon variant="hover" {...props}>
      <InfoCircle size={20} />
    </ActionIcon>
  );
}
