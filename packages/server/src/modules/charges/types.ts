import type {
  IGetChargesByFiltersResult as IGetChargesByFiltersResultRaw,
  IGetChargesByIdsResult as IGetChargesByIdsResultRaw,
} from './__generated__/charges.types.js';
import { ChargeRequiredWrapper } from './providers/charges.provider.js';

export * from './__generated__/types.js';

export type IGetChargesByIdsResult = ChargeRequiredWrapper<IGetChargesByIdsResultRaw>;
export type IGetChargesByFiltersResult = ChargeRequiredWrapper<IGetChargesByFiltersResultRaw>;

export * from './__generated__/charges.types.js';
export * from './__generated__/charge-spread.types.js';

export type {
  IGetTempChargesByIdsParams,
  IGetTempChargesByIdsResult,
  IGetTempChargesByIdsQuery,
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
} from './__generated__/temp-charges.types.js';
