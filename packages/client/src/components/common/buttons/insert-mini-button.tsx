import type { ComponentProps, ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { Tooltip } from '@mantine/core';
import { Button } from '../../ui/button.js';

export function InsertMiniButton(
  props: ComponentProps<typeof Button> & { tooltip?: string },
): ReactElement {
  return (
    <Tooltip disabled={!props.tooltip} label={props.tooltip}>
      <Button variant="ghost" size="icon" className="size-7.5" {...props}>
        <Plus className="size-5" />
      </Button>
    </Tooltip>
  );
}
