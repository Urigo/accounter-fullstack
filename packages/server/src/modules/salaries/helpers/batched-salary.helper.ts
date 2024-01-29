import type { IGetChargesByIdsResult } from '@modules/charges/types';
import { BATCHED_EMPLOYEE_BUSINESS_ID } from '@shared/constants';

const BATCHED_CHARGE_KEYWORDS = ['batch', 'מקובץ', 'מקובצת'];

export function isBatchedCharge(charge: IGetChargesByIdsResult) {
  if (charge.business_array?.includes(BATCHED_EMPLOYEE_BUSINESS_ID)) {
    return true;
  }

  const description = charge.user_description?.toLocaleLowerCase();
  if (!description) {
    return false;
  }
  for (const keyword of BATCHED_CHARGE_KEYWORDS) {
    if (description.includes(keyword)) {
      return true;
    }
  }

  return false;
}
