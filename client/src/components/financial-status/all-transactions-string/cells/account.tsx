import { CSSProperties } from 'react';

import type { TransactionType } from '../../../../models/types';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const Account = ({ transaction, style }: Props) => {
  return (
    <td style={{ ...style }}>
      {transaction.account_number}
      {transaction.account_type}
    </td>
  );
};
