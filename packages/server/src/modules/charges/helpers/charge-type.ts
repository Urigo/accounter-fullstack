import { VAT_BUSINESS_ID } from '@shared/constants';
import { ChargeTypeEnum } from '@shared/enums';
import type { IGetChargesByIdsResult } from '../types.js';

export function getChargeType(
  charge: IGetChargesByIdsResult,
  context: GraphQLModules.Context,
): ChargeTypeEnum {
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

  const { bankDeposits, financialAccounts } = context.adminContext;
  const { internalWalletsIds, creditCardIds } = financialAccounts;

  if (
    bankDeposits.bankDepositBusinessId &&
    (charge.business_id === bankDeposits.bankDepositBusinessId ||
      charge.business_array?.includes(bankDeposits.bankDepositBusinessId))
  ) {
    return ChargeTypeEnum.BankDeposit;
  }

  if (
    (charge.business_array?.filter(businessId => internalWalletsIds.includes(businessId))?.length ??
      0) > 1
  ) {
    return ChargeTypeEnum.InternalTransfer;
  }

  if (
    charge.business_array?.some(businessId =>
      context.adminContext.dividends.dividendBusinessIds.includes(businessId),
    )
  ) {
    return ChargeTypeEnum.Dividend;
  }

  if (charge.business_id === VAT_BUSINESS_ID) {
    return ChargeTypeEnum.MonthlyVat;
  }

  if (charge.business_id && creditCardIds.includes(charge.business_id)) {
    return ChargeTypeEnum.CreditcardBankCharge;
  }

  return ChargeTypeEnum.Common;
}
