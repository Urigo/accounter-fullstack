import { CSSProperties } from 'react';
import type { TransactionType } from '../../../../models/types';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const BankDescription = ({ transaction, style }: Props) => {
  return <td style={{ ...style }}>{transaction.detailed_bank_description}</td>;
};
