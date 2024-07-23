import {
  BANK_DEPOSIT_BUSINESS_ID,
  DIVIDEND_BUSINESS_IDS,
  INTERNAL_WALLETS_IDS,
  ISRACARD_BUSINESS_ID,
  VAT_BUSINESS_ID,
} from '@shared/constants';
import { ChargeTypeEnum } from '@shared/enums';
import type { IGetChargesByIdsResult } from '../types.js';

export function getChargeType(charge: IGetChargesByIdsResult): ChargeTypeEnum {
  switch (charge.type) {
    case 'CONVERSION':
      return ChargeTypeEnum.Conversion;
    case 'PAYROLL':
      return ChargeTypeEnum.Salary;
    case 'FINANCIAL':
      return ChargeTypeEnum.Financial;
  }

  if (charge.business_trip_id) {
    return ChargeTypeEnum.BusinessTrip;
  }

  if (
    charge.business_id === BANK_DEPOSIT_BUSINESS_ID ||
    charge.business_array?.includes(BANK_DEPOSIT_BUSINESS_ID)
  ) {
    return ChargeTypeEnum.BankDeposit;
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

  if (charge.business_id && [ISRACARD_BUSINESS_ID].includes(charge.business_id)) {
    return ChargeTypeEnum.CreditcardBankCharge;
  }

  return ChargeTypeEnum.Common;
}
