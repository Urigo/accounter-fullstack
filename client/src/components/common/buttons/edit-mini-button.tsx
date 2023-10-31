import { ReactElement } from 'react';
import { Edit } from 'tabler-icons-react';
import { ActionIcon, ActionIconProps, Tooltip } from '@mantine/core';
import { PolymorphicComponentProps } from '@mantine/core/lib/core/factory/create-polymorphic-component';

export function EditMiniButton(
  props: PolymorphicComponentProps<'button', ActionIconProps> & { tooltip?: string },
): ReactElement {
  return (
    <Tooltip disabled={!props.tooltip} label={props.tooltip}>
      <ActionIcon variant="filled" {...props}>
        <Edit size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
