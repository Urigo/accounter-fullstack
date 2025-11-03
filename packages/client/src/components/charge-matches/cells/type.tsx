import { useMemo, type ReactElement } from 'react';
import { ThemeIcon } from '@mantine/core';
import { getChargeTypeIcon, getChargeTypeName, type ChargeType } from '../../../helpers/index.js';

type Props = {
  type: ChargeType;
};

export const TypeCell = ({ type }: Props): ReactElement => {
  const { text, icon } = useMemo(
    (): {
      text: string;
      icon: ReactElement;
    } => ({
      text: getChargeTypeName(type),
      icon: getChargeTypeIcon(type),
    }),
    [type],
  );
  return (
    <>
      <div>{text}</div>
      <ThemeIcon radius="xl" size="xl">
        {icon}
      </ThemeIcon>
    </>
  );
};
