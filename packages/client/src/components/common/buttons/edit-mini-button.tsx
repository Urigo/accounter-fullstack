import { ReactElement } from 'react';
import { Edit } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';

export function EditMiniButton(
  props: React.ComponentProps<typeof ActionIcon> & {
    tooltip?: string;
    onClick: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  },
): ReactElement {
  return (
    <Tooltip disabled={!props.tooltip} label={props.tooltip}>
      <ActionIcon {...props}>
        <Edit size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
