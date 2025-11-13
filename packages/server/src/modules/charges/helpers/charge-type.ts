import { BusinessTripsProvider } from '@modules/business-trips/providers/business-trips.provider.js';
import { ChargeTypeEnum } from '@shared/enums';
import { ChargesTempProvider } from '../providers/charges-temp.provider.js';
import { getChargeBusinesses } from './charge-summaries.helper.js';

export async function getChargeType(
  chargeId: string,
  context: GraphQLModules.Context,
): Promise<ChargeTypeEnum> {
  const [charge, { allBusinessIds, mainBusiness }, businessTrip] = await Promise.all([
    context.injector.get(ChargesTempProvider).getChargeByIdLoader.load(chargeId),
    getChargeBusinesses(chargeId, context.injector),
    context.injector.get(BusinessTripsProvider).getBusinessTripsByChargeIdLoader.load(chargeId),
  ]);

  switch (charge.type) {
    case 'CONVERSION':
      return ChargeTypeEnum.Conversion;
    case 'PAYROLL':
      return ChargeTypeEnum.Salary;
    case 'FINANCIAL':
      return ChargeTypeEnum.Financial;
    case 'BANK_DEPOSIT':
      return ChargeTypeEnum.BankDeposit;
  }

  if (businessTrip) {
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
    (mainBusiness === bankDepositBusinessId || allBusinessIds?.includes(bankDepositBusinessId))
  ) {
    return ChargeTypeEnum.BankDeposit;
  }

  if (
    foreignSecuritiesBusinessId &&
    (mainBusiness === foreignSecuritiesBusinessId ||
      allBusinessIds?.includes(foreignSecuritiesBusinessId))
  ) {
    return ChargeTypeEnum.ForeignSecurities;
  }

  if (
    (allBusinessIds?.filter(businessId => internalWalletsIds.includes(businessId))?.length ?? 0) > 1
  ) {
    return ChargeTypeEnum.InternalTransfer;
  }

  if (allBusinessIds?.some(businessId => dividendBusinessIds.includes(businessId))) {
    return ChargeTypeEnum.Dividend;
  }

  if (mainBusiness === vatBusinessId) {
    return ChargeTypeEnum.MonthlyVat;
  }

  if (mainBusiness && creditCardIds.includes(mainBusiness)) {
    return ChargeTypeEnum.CreditcardBankCharge;
  }

  return ChargeTypeEnum.Common;
}
