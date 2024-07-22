import type {
  IGetChargesByFiltersResult as IGetChargesByFiltersResultRaw,
  IGetChargesByFinancialAccountIdsResult as IGetChargesByFinancialAccountIdsResultRaw,
  IGetChargesByFinancialEntityIdsResult as IGetChargesByFinancialEntityIdsResultRaw,
  IGetChargesByIdsResult as IGetChargesByIdsResultRaw,
  IGetChargesByTransactionIdsResult as IGetChargesByTransactionIdsResultRaw,
  IUpdateChargeResult as IUpdateChargeResultRaw,
} from './__generated__/charges.types.js';
import { ChargeRequiredWrapper } from './providers/charges.provider.js';

export * from './__generated__/types.js';

export type IGetChargesByIdsResult = ChargeRequiredWrapper<IGetChargesByIdsResultRaw>;
export type IGetChargesByFinancialAccountIdsResult =
  ChargeRequiredWrapper<IGetChargesByFinancialAccountIdsResultRaw>;
export type IGetChargesByFinancialEntityIdsResult =
  ChargeRequiredWrapper<IGetChargesByFinancialEntityIdsResultRaw>;
export type IUpdateChargeResult = ChargeRequiredWrapper<IUpdateChargeResultRaw>;
export type IGetChargesByFiltersResult = ChargeRequiredWrapper<IGetChargesByFiltersResultRaw>;
export type IGetChargesByTransactionIdsResult =
  ChargeRequiredWrapper<IGetChargesByTransactionIdsResultRaw>;

export * from './__generated__/charges.types.js';
export * from './__generated__/charge-spread.types.js';
