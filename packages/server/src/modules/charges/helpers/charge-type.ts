import { Injector } from 'graphql-modules';
import { ChargeTypeEnum } from '../../../shared/enums.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { BusinessTripsProvider } from '../../business-trips/providers/business-trips.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import type { charge_type, IGetChargesByIdsResult } from '../types.js';
import { getChargeBusinesses } from './common.helper.js';

export function normalizeDbType(chargeType: charge_type): ChargeTypeEnum {
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

export function normalizeOptionalDbType(
  chargeType?: charge_type | null,
): ChargeTypeEnum | undefined {
  if (!chargeType) {
    return undefined;
  }
  return normalizeDbType(chargeType);
}

/**
 * Request-scoped memoization of derived charge types, keyed by the
 * operation-scoped injector. A null-typed charge's type is derived from its
 * businesses/transactions and is probed up to ~10 times per charge by the
 * `__isTypeOf` chain (plus validation and suggestions) — cache the derivation
 * promise so it runs once per charge per request. Charges with an explicit
 * `type` bypass the cache entirely.
 */
const derivedChargeTypeCache = new WeakMap<Injector, Map<string, Promise<ChargeTypeEnum>>>();

export async function getChargeType(
  charge: IGetChargesByIdsResult,
  injector: Injector,
): Promise<ChargeTypeEnum> {
  const type = normalizeOptionalDbType(charge.type);
  if (type) {
    return type;
  }

  let cache = derivedChargeTypeCache.get(injector);
  if (!cache) {
    cache = new Map();
    derivedChargeTypeCache.set(injector, cache);
  }
  const cached = cache.get(charge.id);
  if (cached) {
    return cached;
  }
  const derived = deriveChargeType(charge, injector);
  cache.set(charge.id, derived);
  return derived;
}

async function deriveChargeType(
  charge: IGetChargesByIdsResult,
  injector: Injector,
): Promise<ChargeTypeEnum> {
  const [{ allBusinessIds, mainBusinessId }, businessTrip, transactions] = await Promise.all([
    getChargeBusinesses(charge, injector),
    injector.get(BusinessTripsProvider).getBusinessTripsByChargeIdLoader.load(charge.id),
    injector.get(TransactionsProvider).transactionsByChargeIDLoader.load(charge.id),
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
  } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

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
