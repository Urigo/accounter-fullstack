import { ReactElement } from 'react';
import { ExternalLink } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { ActionIcon } from '../../ui/action-icon.js';

export function ChargeNavigateButton(props: { chargeId: string }): ReactElement {
  return (
    <Tooltip label="To Charge">
      <ActionIcon
        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
          event.stopPropagation();
          window.open(`/charges/${props.chargeId}`, '_blank', 'noreferrer');
        }}
      >
        <ExternalLink size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
