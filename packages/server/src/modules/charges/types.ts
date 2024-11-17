import type {
  IGetChargesByFiltersResult as IGetChargesByFiltersResultRaw,
  IGetChargesByFinancialAccountIdsResult as IGetChargesByFinancialAccountIdsResultRaw,
  IGetChargesByFinancialEntityIdsResult as IGetChargesByFinancialEntityIdsResultRaw,
  IGetChargesByIdsResult as IGetChargesByIdsResultRaw,
  IGetChargesByTransactionIdsResult as IGetChargesByTransactionIdsResultRaw,
} from './__generated__/charges.types.js';
import { ChargeRequiredWrapper } from './providers/charges.provider.js';

export * from './__generated__/types.js';

export type IGetChargesByIdsResult = ChargeRequiredWrapper<IGetChargesByIdsResultRaw>;
export type IGetChargesByFinancialAccountIdsResult =
  ChargeRequiredWrapper<IGetChargesByFinancialAccountIdsResultRaw>;
export type IGetChargesByFinancialEntityIdsResult =
  ChargeRequiredWrapper<IGetChargesByFinancialEntityIdsResultRaw>;
export type IGetChargesByFiltersResult = ChargeRequiredWrapper<IGetChargesByFiltersResultRaw>;
export type IGetChargesByTransactionIdsResult =
  ChargeRequiredWrapper<IGetChargesByTransactionIdsResultRaw>;

export * from './__generated__/charges.types.js';
export type {
  IGetMainChargesByIdsParams,
  IGetMainChargesByIdsResult,
  IGetMainChargesByIdsQuery,
  IGetMainChargesByTransactionIdsParams,
  IGetMainChargesByTransactionIdsResult,
  IGetMainChargesByTransactionIdsQuery,
  IGetMainChargesByOwnerIdsParams,
  IGetMainChargesByOwnerIdsResult,
  IGetMainChargesByOwnerIdsQuery,
  IUpdateChargeParams,
  IUpdateChargeResult,
  IUpdateChargeQuery,
  IUpdateAccountantApprovalParams,
  IUpdateAccountantApprovalResult,
  IUpdateAccountantApprovalQuery,
  IGenerateChargeParams,
  IGenerateChargeResult,
  IGenerateChargeQuery,
  IDeleteChargesByIdsParams,
  IDeleteChargesByIdsResult,
  IDeleteChargesByIdsQuery,
} from './__generated__/main-charges.types.js';
export * from './__generated__/charge-spread.types.js';
