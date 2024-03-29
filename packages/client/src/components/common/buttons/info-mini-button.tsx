import { ReactElement } from 'react';
import { InfoCircle } from 'tabler-icons-react';
import { ActionIcon, ActionIconProps } from '@mantine/core';
import { PolymorphicComponentProps } from '@mantine/utils';

export function InfoMiniButton(
  props: PolymorphicComponentProps<'button', ActionIconProps>,
): ReactElement {
  return (
    <ActionIcon {...props}>
      <InfoCircle size={20} />
    </ActionIcon>
  );
}
