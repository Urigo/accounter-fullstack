import { useMemo, type ReactElement } from 'react';
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
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-blue-500 text-white">
        {icon}
      </span>
    </>
  );
};
