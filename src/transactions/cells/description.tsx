import * as React from 'react';
import { ConfirmButton } from '../components/confirmButton';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import { suggestedTransaction } from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
};

export const Description: React.FC<Props> = ({ transaction }) => {
  const isDescription = !!transaction.user_description;
  const cellText = transaction.user_description
    ? transaction.user_description
    : suggestedTransaction(transaction)?.userDescription;

  return (
    <td
      style={
        transaction.user_description
          ? undefined
          : { backgroundColor: 'rgb(236, 207, 57)' }
      }
    >
      {cellText ?? 'undefined'}
      {isDescription && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'user_description'}
          value={cellText}
        />
      )}
      <UpdateButton
        transaction={transaction}
        propertyName={'user_description'}
        promptText="New user description:"
      />
    </td>
  );
};
