import { ReactElement } from 'react';
import { InfoCircle } from 'tabler-icons-react';
import { ActionIcon, ActionIconProps } from '@mantine/core';
import { PolymorphicComponentProps } from '@mantine/core/lib/core/factory/create-polymorphic-component';

export function InfoMiniButton(
  props: PolymorphicComponentProps<'button', ActionIconProps>,
): ReactElement {
  return (
    <ActionIcon {...props}>
      <InfoCircle size={20} />
    </ActionIcon>
  );
}
