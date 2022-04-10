import { CSSProperties, FC } from 'react';
import type { TransactionType } from '../../../../models/types';
import { ConfirmButton, UpdateButton } from '../../../common';
import { suggestedTransaction } from '../../../../helpers';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const Description: FC<Props> = ({ transaction, style }) => {
  const isDescription = !!transaction.user_description;
  const cellText =
    transaction.user_description ??
    suggestedTransaction(transaction)?.userDescription;

  return (
    <td
      style={{
        ...(transaction.user_description
          ? {}
          : { backgroundColor: 'rgb(236, 207, 57)' }),
        ...style,
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
