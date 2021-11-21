import * as React from 'react';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
  style: React.CSSProperties;
};

export const BankDescription: React.FC<Props> = ({ transaction, style }) => {
  return <td style={{...style}}>{transaction.detailed_bank_description}</td>;
};
