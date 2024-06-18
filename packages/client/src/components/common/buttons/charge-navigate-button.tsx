import { ReactElement } from 'react';
import { ExternalLink } from 'tabler-icons-react';
import { ActionIcon, ActionIconProps, Tooltip } from '@mantine/core';
import { PolymorphicComponentProps } from '@mantine/utils';

export function ChargeNavigateButton(
  props: PolymorphicComponentProps<'button', ActionIconProps> & { chargeId: string },
): ReactElement {
  return (
    <Tooltip label="To Charge">
      <ActionIcon
        onClick={event => {
          event.stopPropagation();
          window.open(`/charges/${props.chargeId}`, '_blank', 'noreferrer');
        }}
      >
        <ExternalLink size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
