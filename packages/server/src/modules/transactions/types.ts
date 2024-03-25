import {
  IGetTransactionsByChargeIdsResult as IGetTransactionsByChargeIdsResultRaw,
  IGetTransactionsByFiltersResult as IGetTransactionsByFiltersResultRaw,
  IGetTransactionsByIdsResult as IGetTransactionsByIdsResultRaw,
} from './__generated__/transactions.types.js';
import { TransactionRequiredWrapper } from './providers/transactions.provider.js';

export * from './__generated__/transactions.types.js';
export type * from './__generated__/fee-transactions.types.js';
export type {
  IGetBankDepositTransactionsByIdsParams,
  IGetBankDepositTransactionsByIdsResult,
  IGetBankDepositTransactionsByIdsQuery,
  IGetTransactionsByBankDepositsParams,
  IGetTransactionsByBankDepositsResult,
  IGetTransactionsByBankDepositsQuery,
  IGetDepositTransactionsByTransactionIdParams,
  IGetDepositTransactionsByTransactionIdResult,
  IGetDepositTransactionsByTransactionIdQuery,
  IGetDepositTransactionsByChargeIdParams,
  IGetDepositTransactionsByChargeIdResult,
  IGetDepositTransactionsByChargeIdQuery,
  IUpdateBankDepositTransactionParams,
  IUpdateBankDepositTransactionResult,
  IUpdateBankDepositTransactionQuery,
  IAddBankDepositTransactionParams,
  IAddBankDepositTransactionResult,
  IAddBankDepositTransactionQuery,
  IDeleteBankDepositTransactionsByIdsParams,
  IDeleteBankDepositTransactionsByIdsResult,
  IDeleteBankDepositTransactionsByIdsQuery,
} from './__generated__/bank-deposit-transactions.types.js';
export * from './__generated__/types.js';

export type IGetTransactionsByIdsResult =
  TransactionRequiredWrapper<IGetTransactionsByIdsResultRaw>;
export type IGetTransactionsByChargeIdsResult =
  TransactionRequiredWrapper<IGetTransactionsByChargeIdsResultRaw>;
export type IGetTransactionsByFiltersResult =
  TransactionRequiredWrapper<IGetTransactionsByFiltersResultRaw>;
