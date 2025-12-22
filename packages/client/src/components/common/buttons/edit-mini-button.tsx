import type { ComponentProps, MouseEvent, ReactElement } from 'react';
import { Edit } from 'lucide-react';
import { Button } from '../../ui/button.js';
import { Tooltip } from '../index.js';

export function EditMiniButton(
  props: ComponentProps<typeof Button> & {
    tooltip?: string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  },
): ReactElement {
  return (
    <Tooltip disabled={!props.tooltip} content={props.tooltip}>
      <Button className="size-7.5" variant="ghost" {...props}>
        <Edit className="size-5" />
      </Button>
    </Tooltip>
  );
}
