import { ReactElement } from 'react';
import { Check } from 'tabler-icons-react';
import { ActionIcon, ActionIconProps } from '@mantine/core';
import { PolymorphicComponentProps } from '@mantine/core/lib/core/factory/create-polymorphic-component';

export function ConfirmMiniButton(
  props: PolymorphicComponentProps<'button', ActionIconProps>,
): ReactElement {
  return (
    <ActionIcon color="green" {...props}>
      <Check size={20} />
    </ActionIcon>
  );
}
