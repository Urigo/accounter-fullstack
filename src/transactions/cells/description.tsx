import * as React from 'react';
import { ConfirmButton } from '../components/confirmButton';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import { suggestedTransaction } from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
  style: React.CSSProperties;
};

export const Description: React.FC<Props> = ({ transaction, style }) => {
  const isDescription = !!transaction.user_description;
  const cellText = transaction.user_description
    ? transaction.user_description
    : suggestedTransaction(transaction)?.userDescription;

  return (
    <td
      style={{
        ...style,
        ...(transaction.user_description
          ? {}
          : { backgroundColor: 'rgb(236, 207, 57)' }),
      }}
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
