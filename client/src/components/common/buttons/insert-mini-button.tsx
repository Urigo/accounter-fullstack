import { ReactElement } from 'react';
import { RowInsertTop } from 'tabler-icons-react';
import { ActionIcon, ActionIconProps, Tooltip } from '@mantine/core';
import { PolymorphicComponentProps } from '@mantine/utils';

export function InsertMiniButton(
  props: PolymorphicComponentProps<'button', ActionIconProps> & { tooltip?: string },
): ReactElement {
  return (
    <Tooltip disabled={!props.tooltip} label={props.tooltip}>
      <ActionIcon {...props}>
        <RowInsertTop size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
