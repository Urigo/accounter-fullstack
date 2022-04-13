import { CSSProperties, FC } from 'react';
import type { TransactionType } from '../../../../models/types';
import { ConfirmButton, UpdateButton } from '../../../common';
import { suggestedTransaction } from '../../../../helpers';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const Category: FC<Props> = ({ transaction, style }) => {
  const isPersonalCategory = !!transaction.personal_category;
  const cellText =
    transaction.personal_category ??
    suggestedTransaction(transaction)?.financialEntity;

  return (
    <td
      style={{
        ...(isPersonalCategory ? {} : { backgroundColor: 'rgb(236, 207, 57)' }),
        ...style,
      }}
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
