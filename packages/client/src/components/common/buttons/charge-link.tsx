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
    <Button
      key={chargeId}
      variant="link"
      className="h-auto justify-start p-0"
      onClick={event => {
        event.stopPropagation();
        window.open(ROUTES.CHARGES.DETAIL(chargeId), '_blank', 'noreferrer');
      }}
    >
      {label}
    </Button>
  );
};
