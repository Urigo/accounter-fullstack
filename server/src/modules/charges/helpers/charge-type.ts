import { INTERNAL_WALLETS_IDS } from '@shared/constants';
import type { IGetChargesByIdsResult } from '../types.js';

export function getChargeType(charge: IGetChargesByIdsResult) {
  if (charge.is_conversion) {
    return 'ConversionCharge';
  }

  if (charge.is_salary) {
    return 'SalaryCharge';
  }

  if (
    (charge.business_array?.filter(businessId => INTERNAL_WALLETS_IDS.includes(businessId))
      ?.length ?? 0) > 1
  ) {
    return 'InternalTransferCharge';
  }

  return 'CommonCharge';
}
