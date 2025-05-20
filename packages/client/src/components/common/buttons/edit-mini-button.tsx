import type { ComponentProps, MouseEvent, ReactElement } from 'react';
import { Edit } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { Button } from '../../ui/button.js';

export function EditMiniButton(
  props: ComponentProps<typeof Button> & {
    tooltip?: string;
    onClick: (event: MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  },
): ReactElement {
  return (
    <Tooltip disabled={!props.tooltip} label={props.tooltip}>
      <Button {...props} className="size-7.5" variant="ghost">
        <Edit className="size-5" />
      </Button>
    </Tooltip>
  );
}
