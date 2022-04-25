import { CSSProperties, FC } from 'react';
import type { TransactionType } from '../../../../models/types';
import { ConfirmButton, UpdateButton } from '../../../common';
import { suggestedTransaction } from '../../../../helpers';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const Entity: FC<Props> = ({ transaction, style }) => {
  const isFinancialEntity = !!transaction.financial_entity;
  const cellText =
    transaction.financial_entity ??
    suggestedTransaction(transaction)?.financialEntity;

  return (
    <td
      style={{
        ...(isFinancialEntity ? {} : { backgroundColor: 'rgb(236, 207, 57)' }),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {!transaction.financial_entity && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'financial_entity'}
          value={cellText}
        />
      )}
      <UpdateButton
        transaction={transaction}
        propertyName={'financial_entity'}
        promptText="New financial entity:"
      />
    </td>
  );
};
