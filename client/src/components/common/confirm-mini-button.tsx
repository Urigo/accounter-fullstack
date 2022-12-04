import { ActionIcon, ActionIconProps } from '@mantine/core';
import { PolymorphicComponentProps } from '@mantine/utils';
import { Check } from 'tabler-icons-react';

export function ConfirmMiniButton(props: PolymorphicComponentProps<'button', ActionIconProps>) {
  return (
    <ActionIcon color="green" {...props}>
      <Check size={20} />
    </ActionIcon>
  );
}
