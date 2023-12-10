import { DIVIDEND_BUSINESS_IDS, INTERNAL_WALLETS_IDS } from '@shared/constants';
import type { IGetChargesByIdsResult } from '../types.js';

export function getChargeType(charge: IGetChargesByIdsResult) {
  if (charge.is_conversion) {
    return 'ConversionCharge';
  }

  if (charge.is_salary) {
    return 'SalaryCharge';
  }

  if (charge.business_trip_id) {
    return 'BusinessTripCharge';
  }

  if (
    (charge.business_array?.filter(businessId => INTERNAL_WALLETS_IDS.includes(businessId))
      ?.length ?? 0) > 1
  ) {
    return 'InternalTransferCharge';
  }

  if (charge.business_array?.some(businessId => DIVIDEND_BUSINESS_IDS.includes(businessId))) {
    return 'DividendCharge';
  }

  return 'CommonCharge';
}
