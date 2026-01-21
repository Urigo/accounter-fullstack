import { ChargeTypeEnum } from '../../../shared/enums.js';
import { BusinessTripsProvider } from '../../business-trips/providers/business-trips.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import type { charge_type, IGetChargesByIdsResult } from '../types.js';
import { getChargeBusinesses } from './common.helper.js';

function normalizeDbType(chargeType?: charge_type | null): ChargeTypeEnum | undefined {
  if (!chargeType) {
    return undefined;
  }
  switch (chargeType) {
    case 'COMMON':
      return ChargeTypeEnum.Common;
    case 'BANK_DEPOSIT':
      return ChargeTypeEnum.BankDeposit;
    case 'CREDITCARD_BANK':
      return ChargeTypeEnum.CreditcardBankCharge;
    case 'DIVIDEND':
      return ChargeTypeEnum.Dividend;
    case 'FOREIGN_SECURITIES':
      return ChargeTypeEnum.ForeignSecurities;
    case 'INTERNAL':
      return ChargeTypeEnum.InternalTransfer;
    case 'VAT':
      return ChargeTypeEnum.MonthlyVat;
    case 'PAYROLL':
      return ChargeTypeEnum.Salary;
    case 'BUSINESS_TRIP':
      return ChargeTypeEnum.BusinessTrip;
    case 'CONVERSION':
      return ChargeTypeEnum.Conversion;
    case 'FINANCIAL':
      return ChargeTypeEnum.Financial;
    default:
      throw new Error(`Unsupported charge type: ${chargeType}`);
  }
}

export async function getChargeType(
  charge: IGetChargesByIdsResult,
  context: GraphQLModules.Context,
): Promise<ChargeTypeEnum> {
  const type = normalizeDbType(charge.type);
  if (type) {
    return type;
  }

  const [{ allBusinessIds, mainBusinessId }, businessTrip, transactions] = await Promise.all([
    getChargeBusinesses(charge.id, context.injector),
    context.injector.get(BusinessTripsProvider).getBusinessTripsByChargeIdLoader.load(charge.id),
    context.injector.get(TransactionsProvider).transactionsByChargeIDLoader.load(charge.id),
  ]);

  if (businessTrip) {
    return ChargeTypeEnum.BusinessTrip;
  }

  const {
    foreignSecurities: { foreignSecuritiesBusinessId },
    bankDeposits: { bankDepositBusinessId },
    dividends: { dividendBusinessIds },
    authorities: { vatBusinessId },
    financialAccounts: { creditCardIds },
  } = context.adminContext;

  if (
    bankDepositBusinessId &&
    (mainBusinessId === bankDepositBusinessId || allBusinessIds.includes(bankDepositBusinessId))
  ) {
    return ChargeTypeEnum.BankDeposit;
  }

  if (
    foreignSecuritiesBusinessId &&
    (mainBusinessId === foreignSecuritiesBusinessId ||
      allBusinessIds.includes(foreignSecuritiesBusinessId))
  ) {
    return ChargeTypeEnum.ForeignSecurities;
  }

  if (new Set(transactions.map(t => t.account_id).filter(Boolean)).size > 1) {
    return ChargeTypeEnum.InternalTransfer;
  }

  if (allBusinessIds.some(businessId => dividendBusinessIds.includes(businessId))) {
    return ChargeTypeEnum.Dividend;
  }

  if (mainBusinessId === vatBusinessId) {
    return ChargeTypeEnum.MonthlyVat;
  }

  if (mainBusinessId && creditCardIds.includes(mainBusinessId)) {
    return ChargeTypeEnum.CreditcardBankCharge;
  }

  return ChargeTypeEnum.Common;
}
