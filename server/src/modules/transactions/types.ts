import {
  IGetTransactionsByChargeIdsResult as IGetTransactionsByChargeIdsResultRaw,
  IGetTransactionsByFiltersResult as IGetTransactionsByFiltersResultRaw,
  IGetTransactionsByIdsResult as IGetTransactionsByIdsResultRaw,
} from './__generated__/transactions.types.js';
import { TransactionRequiredWrapper } from './providers/transactions.provider.js';

export * from './__generated__/transactions.types.js';
export * from './__generated__/types.js';

export type IGetTransactionsByIdsResult =
  TransactionRequiredWrapper<IGetTransactionsByIdsResultRaw>;
export type IGetTransactionsByChargeIdsResult =
  TransactionRequiredWrapper<IGetTransactionsByChargeIdsResultRaw>;
export type IGetTransactionsByFiltersResult =
  TransactionRequiredWrapper<IGetTransactionsByFiltersResultRaw>;
