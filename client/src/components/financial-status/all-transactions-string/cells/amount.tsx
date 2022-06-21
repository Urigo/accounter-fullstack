import { CSSProperties } from 'react';

import { currencyCodeToSymbol } from '../../../../helpers';
import type { TransactionType } from '../../../../models/types';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const Amount = ({ transaction, style }: Props) => {
  return (
    <td style={{ ...style }}>
      {transaction.event_amount}
      {currencyCodeToSymbol(transaction.currency_code)}
    </td>
  );
};
