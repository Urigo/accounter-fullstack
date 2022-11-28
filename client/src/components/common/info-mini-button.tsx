import { ActionIcon } from '@mantine/core';
import { InfoCircle } from 'tabler-icons-react';

export function InfoMiniButton(props: React.ComponentProps<typeof ActionIcon>) {
  return (
    <ActionIcon {...props}>
      <InfoCircle size={20} />
    </ActionIcon>
  );
}
