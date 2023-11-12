import type { IGetChargesByIdsResult } from '@modules/charges/types';

const BATCHED_CHARGE_KEYWORDS = ['batch', 'מקובץ', 'מקובצת'];

export function isBatchedCharge(charge: IGetChargesByIdsResult) {
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
