import * as React from 'react';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
};

export const TaxCategory: React.FC<Props> = ({ transaction }) => {
  return (
    <div>
      {transaction.tax_category}
      <UpdateButton
        transaction={transaction}
        propertyName={'tax_category'}
        promptText="New Tax category:"
      />
    </div>
  );
};
