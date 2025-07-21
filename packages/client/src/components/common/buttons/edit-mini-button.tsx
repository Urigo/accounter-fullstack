import type { ComponentProps, MouseEvent, ReactElement } from 'react';
import { Edit } from 'lucide-react';
import { Tooltip } from '@mantine/core';
import { Button } from '../../ui/button.js';

export function EditMiniButton(
  props: ComponentProps<typeof Button> & {
    tooltip?: string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  },
): ReactElement {
  return (
    <Tooltip disabled={!props.tooltip} label={props.tooltip}>
      <Button className="size-7.5" variant="ghost" {...props}>
        <Edit className="size-5" />
      </Button>
    </Tooltip>
  );
}
