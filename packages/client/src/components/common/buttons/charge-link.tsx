import type { ReactElement } from 'react';
import { ROUTES } from '@/router/routes.js';
import { Button } from '../../ui/button.js';

export const ChargeLink = ({
  chargeId,
  label,
}: {
  chargeId: string;
  label: string;
}): ReactElement => {
  return (
    <Button key={chargeId} asChild variant="link" className="h-auto justify-start p-0">
      <a
        href={ROUTES.CHARGES.DETAIL(chargeId)}
        target="_blank"
        rel="noreferrer"
        onClick={event => event.stopPropagation()}
      >
        {label}
      </a>
    </Button>
  );
};
