import type {
  IGetChargesByTransactionIdsResult as IGetChargesByTransactionIdsResultRaw,
  IUpdateChargeResult as IUpdateChargeResultRaw,
} from './__generated__/charges-temp.types.js';
import type {
  IGetChargesByFiltersResult as IGetChargesByFiltersResultRaw,
  IGetChargesByIdsResult as IGetChargesByIdsResultRaw,
} from './__generated__/charges.types.js';
import { ChargeRequiredWrapper } from './providers/charges.provider.js';

export * from './__generated__/types.js';

export type IGetChargesByIdsResult = ChargeRequiredWrapper<IGetChargesByIdsResultRaw>;
export type IUpdateChargeResult = ChargeRequiredWrapper<IUpdateChargeResultRaw>;
export type IGetChargesByFiltersResult = ChargeRequiredWrapper<IGetChargesByFiltersResultRaw>;
export type IGetChargesByTransactionIdsResult =
  ChargeRequiredWrapper<IGetChargesByTransactionIdsResultRaw>;

export type {
  IGetChargesByIdsParams,
  IGetChargesByIdsQuery,
  accountant_status,
  charge_type,
} from './__generated__/charges.types.js';
export * from './__generated__/charges.types.js';
export * from './__generated__/charges-temp.types.js';
export * from './__generated__/charge-spread.types.js';
