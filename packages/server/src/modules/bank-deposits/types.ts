import { TimelessDateString } from '../../shared/types/index.js';

export type * from './__generated__/types.js';
export type { currency } from './__generated__/bank-deposits.types.js';
export type * from './__generated__/bank-deposits.types.js';
export type * from './__generated__/bank-deposit-charges.types.js';

export type BankDepositMetadataProto = {
  id: string;
  potentialCloseDate: TimelessDateString | null;
  currentBalance: number;
  totalInterest: number;
  totalDeposit: number;
  transactionIds: string[];
};
