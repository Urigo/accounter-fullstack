import type { ReactElement } from 'react';
import { getChargeHref } from '@/components/screens/charges/charge.js';
import { NavLink } from '@mantine/core';

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
        window.open(getChargeHref(chargeId), '_blank', 'noreferrer');
      }}
    />
  );
};
