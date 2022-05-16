import { CSSProperties, FC } from 'react';
import type { TransactionType } from '../../../../models/types';
import { UpdateButton } from '../../../common';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const TaxCategory: FC<Props> = ({ transaction, style }) => {
  return (
    <td style={{ ...style }}>
      {transaction.tax_category ?? 'null'}
      <UpdateButton
        transaction={transaction}
        propertyName="tax_category"
        promptText="New Tax category:"
      />
    </td>
  );
};
