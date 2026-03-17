import type { ReactElement } from 'react';
import { NavLink } from '@mantine/core';
import { ROUTES } from '@/router/routes.js';

export const ChargeLink = ({
  chargeId,
  label,
}: {
  chargeId: string;
  label: string;
}): ReactElement => {
  return (
    <NavLink
      key={chargeId}
      label={label}
      onClick={(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        event.stopPropagation();
        window.open(ROUTES.CHARGES.DETAIL(chargeId), '_blank', 'noreferrer');
      }}
    />
  );
};
