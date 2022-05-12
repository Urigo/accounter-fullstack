import { CSSProperties, FC } from 'react';
import type { TransactionType } from '../../../models/types';
import { ConfirmButton, UpdateButton } from '../../common';
import { shareWithDotan, suggestedTransaction } from '../../../helpers';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const ShareWith: FC<Props> = ({ transaction, style }) => {
  const cellText =
    transaction.financial_accounts_to_balance ??
    suggestedTransaction(transaction)?.financialAccountsToBalance;

  return (
    <td
      style={{
        ...(shareWithDotan(transaction)
          ? { backgroundColor: 'rgb(236, 207, 57)' }
          : {}),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {!transaction.financial_accounts_to_balance && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'financial_accounts_to_balance'}
          value={cellText}
        />
      )}
      <UpdateButton
        transaction={transaction}
        propertyName={'financial_accounts_to_balance'}
        promptText="New Account to share:"
      />
    </td>
  );
};
