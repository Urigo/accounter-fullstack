import * as React from 'react';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
  style: React.CSSProperties;
};

export const TaxCategory: React.FC<Props> = ({ transaction, style }) => {
  return (
    <td style={{...style}}>
      {transaction.tax_category ?? 'null'}
      <UpdateButton
        transaction={transaction}
        propertyName={'tax_category'}
        promptText="New Tax category:"
      />
    </td>
  );
};
