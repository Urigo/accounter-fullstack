import { ReactElement } from 'react';
import { Check } from 'tabler-icons-react';
import { ActionIcon, ActionIconProps } from '@mantine/core';
import { PolymorphicComponentProps } from '@mantine/utils';

export function ConfirmMiniButton(
  props: PolymorphicComponentProps<'button', ActionIconProps> & {
    onClick: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  },
): ReactElement {
  return (
    <ActionIcon color="green" {...props}>
      <Check size={20} />
    </ActionIcon>
  );
}
