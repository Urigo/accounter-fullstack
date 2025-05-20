import type { ComponentProps, ReactElement } from 'react';
import { ExternalLink } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
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
        className="size-7.5"
        variant="ghost"
      >
        <ExternalLink className="size-5" />
      </Button>
    </Tooltip>
  );
}
