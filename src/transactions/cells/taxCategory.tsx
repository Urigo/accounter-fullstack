import * as React from 'react';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
};

export const TaxCategory: React.FC<Props> = ({ transaction }) => {
  return (
    <td>
      {transaction.tax_category ?? 'null'}
      <UpdateButton
        transaction={transaction}
        propertyName={'tax_category'}
        promptText="New Tax category:"
      />
    </td>
  );
};
