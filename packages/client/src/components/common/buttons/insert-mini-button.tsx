import type { ComponentProps, ReactElement } from 'react';
import { RowInsertTop } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { Button } from '../../ui/button.js';

export function InsertMiniButton(
  props: ComponentProps<typeof Button> & { tooltip?: string },
): ReactElement {
  return (
    <Tooltip disabled={!props.tooltip} label={props.tooltip}>
      <Button {...props} className="size-7.5">
        <RowInsertTop className="size-5" />
      </Button>
    </Tooltip>
  );
}
