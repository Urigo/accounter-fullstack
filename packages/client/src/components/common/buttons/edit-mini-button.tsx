import { ReactElement } from 'react';
import { Edit } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { ActionIcon } from '../../ui/action-icon.js';

export function EditMiniButton(props: {
  tooltip?: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}): ReactElement {
  return (
    <Tooltip disabled={!props.tooltip} label={props.tooltip}>
      <ActionIcon {...props}>
        <Edit size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
