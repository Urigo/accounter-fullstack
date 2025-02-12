import { ReactElement } from 'react';
import { RowInsertTop } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { ActionIcon } from '../../ui/action-icon.js';

export function InsertMiniButton(props: {
  tooltip?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}): ReactElement {
  return (
    <Tooltip disabled={!props.tooltip} label={props.tooltip}>
      <ActionIcon {...props}>
        <RowInsertTop size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
