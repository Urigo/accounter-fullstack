import type { ComponentProps, ReactElement } from 'react';
import { ExternalLink } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../ui/button.js';

export function ChargeNavigateButton(
  props: ComponentProps<typeof Button> & { chargeId: string },
): ReactElement {
  return (
    <Tooltip label="To Charge">
      <Button
        onClick={event => {
          event.stopPropagation();
          window.open(`/charges/${props.chargeId}`, '_blank', 'noreferrer');
        }}
        {...props}
        className={cn('size-7.5', props.className)}
        variant="ghost"
      >
        <ExternalLink className="size-5" />
      </Button>
    </Tooltip>
  );
}
