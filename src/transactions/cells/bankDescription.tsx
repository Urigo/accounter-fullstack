import * as React from 'react';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
};

export const BankDescription: React.FC<Props> = ({ transaction }) => {
  return <td>{transaction.detailed_bank_description}</td>;
};
