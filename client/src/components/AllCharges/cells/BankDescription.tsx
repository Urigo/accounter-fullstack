import { CSSProperties, FC } from 'react';
import type { TransactionType } from '../../../models/types';

type Props = {
  transaction: TransactionType;
  style?: CSSProperties;
};

export const BankDescription: FC<Props> = ({ transaction, style }) => {
  return <td style={{ ...style }}>{transaction.detailed_bank_description}</td>;
};
