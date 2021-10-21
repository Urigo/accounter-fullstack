import * as React from 'react';
import { AllTransactionsEntity } from '../getAllTransactions';

type Props = {
  transaction: AllTransactionsEntity;
};

export const BankDescription: React.FC<Props> = ({ transaction }) => {
  return <div>{transaction.detailed_bank_description}</div>;
};
