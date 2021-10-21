import * as React from 'react';
import { ConfirmButton } from '../components/confirmButton';
import { UpdateButton } from '../components/updateButton';
import { AllTransactionsEntity } from '../getAllTransactions';
import {
  businessesWithoutTaxCategory,
  isBusiness,
  suggestedTransaction,
} from '../utils';

type Props = {
  transaction: AllTransactionsEntity;
};

export const ShareWith: React.FC<Props> = ({ transaction }) => {
  const businessesNotToShare = ['Dotan Simha'];

  const privateBusinessExpenses = [
    'Google',
    'Uri Goldshtein',
    'Social Security Deductions',
    'Hot Mobile',
    'Apple',
    'HOT',
    'Yaacov Matri',
    'Partner',
  ];

  const shareWithDotan = (transaction: any) => {
    if (
      transaction.financial_accounts_to_balance == 'no' ||
      transaction.financial_accounts_to_balance === ' ' ||
      transaction.financial_accounts_to_balance === 'yes' ||
      transaction.financial_accounts_to_balance === 'pension' ||
      transaction.financial_accounts_to_balance === 'training_fund'
    ) {
      return false;
    } else {
      return !(
        !isBusiness(transaction) ||
        privateBusinessExpenses.includes(transaction.financial_entity) ||
        businessesNotToShare.includes(transaction.financial_entity) ||
        businessesWithoutTaxCategory.includes(transaction.financial_entity)
      );
    }
  };

  const cellText = transaction.financial_accounts_to_balance
    ? transaction.financial_accounts_to_balance
    : suggestedTransaction(transaction)?.financialAccountsToBalance;

  return (
    <div
      style={
        shareWithDotan(transaction)
          ? undefined
          : { backgroundColor: 'rgb(236, 207, 57)' }
      }
    >
      {cellText}
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
    </div>
  );
};
