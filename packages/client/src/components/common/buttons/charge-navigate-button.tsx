import type { ComponentProps, ReactElement } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Tooltip } from '@mantine/core';
import { cn } from '../../../lib/utils.js';
import { ROUTES } from '../../../router/routes.js';
import { Button } from '../../ui/button.js';

export function ChargeNavigateButton(
  props: ComponentProps<typeof Button> & { chargeId: string },
): ReactElement {
  return (
    <Tooltip label="To Charge">
      <Link
        to={ROUTES.CHARGES.DETAIL(props.chargeId)}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
        className="inline-block"
      >
        <Button {...props} className={cn('size-7.5', props.className)} variant="ghost">
          <ExternalLink className="size-5" />
        </Button>
      </Link>
    </Tooltip>
  );
}
