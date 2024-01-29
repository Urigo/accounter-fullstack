import { DIVIDEND_BUSINESS_IDS, INTERNAL_WALLETS_IDS, VAT_BUSINESS_ID } from '@shared/constants';
import { ChargeTypeEnum } from '@shared/enums';
import type { IGetChargesByIdsResult } from '../types.js';

export function getChargeType(charge: IGetChargesByIdsResult) {
  if (charge.is_conversion) {
    return ChargeTypeEnum.Conversion;
  }

  if (charge.is_salary) {
    return ChargeTypeEnum.Salary;
  }

  if (charge.business_trip_id) {
    return ChargeTypeEnum.BusinessTrip;
  }

  if (
    (charge.business_array?.filter(businessId => INTERNAL_WALLETS_IDS.includes(businessId))
      ?.length ?? 0) > 1
  ) {
    return ChargeTypeEnum.InternalTransfer;
  }

  if (charge.business_array?.some(businessId => DIVIDEND_BUSINESS_IDS.includes(businessId))) {
    return ChargeTypeEnum.Dividend;
  }

  if (charge.business_id === VAT_BUSINESS_ID) {
    return ChargeTypeEnum.MonthlyVat;
  }

  return ChargeTypeEnum.Common;
}
