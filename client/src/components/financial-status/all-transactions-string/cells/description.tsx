import { CSSProperties } from 'react';
import { suggestedTransaction } from '../../../../helpers';
import type { TransactionType } from '../../../../models/types';
import { ConfirmButton, UpdateButton } from '../../../common';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const Description = ({ transaction, style }: Props) => {
  const isDescription = Boolean(transaction.user_description);
  const cellText = transaction.user_description ?? suggestedTransaction(transaction)?.userDescription;

  return (
    <td
      style={{
        ...(isDescription ? {} : { backgroundColor: 'rgb(236, 207, 57)' }),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {!transaction.user_description && (
        <ConfirmButton transaction={transaction} propertyName="user_description" value={cellText} />
      )}
      <UpdateButton transaction={transaction} propertyName="user_description" promptText="New user description:" />
    </td>
  );
};
