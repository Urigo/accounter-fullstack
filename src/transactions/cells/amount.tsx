import * as React from 'react';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
  style: React.CSSProperties;
};

export const Amount: React.FC<Props> = ({ transaction, style }) => {
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
    <td style={{...style}}>
      {transaction.event_amount}
      {currencyCodeToSymbol(transaction.currency_code)}
    </td>
  );
};
