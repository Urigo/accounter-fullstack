import * as React from 'react';
import { ConfirmButton } from '../components/confirmButton';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import { suggestedTransaction } from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
};

export const Category: React.FC<Props> = ({ transaction }) => {
  const isPersonalCategory = !!transaction.personal_category;
  const cellText = transaction.personal_category
    ? transaction.personal_category
    : suggestedTransaction(transaction)?.financialEntity;

  return (
    <td
      style={
        isPersonalCategory
          ? undefined
          : { backgroundColor: 'rgb(236, 207, 57)' }
      }
    >
      {cellText ?? 'undefined'}
      {!transaction.personal_category && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'personal_category'}
          value={cellText}
        />
      )}
      <UpdateButton
        transaction={transaction}
        propertyName={'personal_category'}
        promptText="New personal category:"
      />
    </td>
  );
};
