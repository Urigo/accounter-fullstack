import * as React from 'react';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
};

export const Amount: React.FC<Props> = ({ transaction }) => {
  const currencyCodeToSymbol = (currency_code: string): string => {
    let currencySymbol = '₪';
    if (currency_code == 'USD') {
      currencySymbol = '$';
    } else if (currency_code == 'EUR') {
      currencySymbol = '€';
    }
    return currencySymbol;
  };

  return (
    <td>
      {transaction.event_amount}
      {currencyCodeToSymbol(transaction.currency_code)}
    </td>
  );
};
