import { ChargeTypeEnum } from '@shared/enums';
import { ChargesProvider } from '../providers/charges.provider.js';

export async function getChargeType(
  chargeId: string,
  context: GraphQLModules.Context,
): Promise<ChargeTypeEnum> {
  const charge = await context.injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);

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

  const {
    foreignSecurities: { foreignSecuritiesBusinessId },
    bankDeposits: { bankDepositBusinessId },
    dividends: { dividendBusinessIds },
    authorities: { vatBusinessId },
    financialAccounts: { internalWalletsIds, creditCardIds },
  } = context.adminContext;

  if (
    bankDepositBusinessId &&
    (charge.business_id === bankDepositBusinessId ||
      charge.business_array?.includes(bankDepositBusinessId))
  ) {
    return ChargeTypeEnum.BankDeposit;
  }

  if (
    foreignSecuritiesBusinessId &&
    (charge.business_id === foreignSecuritiesBusinessId ||
      charge.business_array?.includes(foreignSecuritiesBusinessId))
  ) {
    return ChargeTypeEnum.ForeignSecurities;
  }

  if (
    (charge.business_array?.filter(businessId => internalWalletsIds.includes(businessId))?.length ??
      0) > 1
  ) {
    return ChargeTypeEnum.InternalTransfer;
  }

  if (charge.business_array?.some(businessId => dividendBusinessIds.includes(businessId))) {
    return ChargeTypeEnum.Dividend;
  }

  if (charge.business_id === vatBusinessId) {
    return ChargeTypeEnum.MonthlyVat;
  }

  if (charge.business_id && creditCardIds.includes(charge.business_id)) {
    return ChargeTypeEnum.CreditcardBankCharge;
  }

  return ChargeTypeEnum.Common;
}
