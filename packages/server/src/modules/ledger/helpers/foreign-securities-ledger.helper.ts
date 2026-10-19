import type { SecuritiesTaxCategoryKey } from '../../../__generated__/types.js';
import { Currency, SecurityTradeType } from '../../../shared/enums.js';
import { formatCurrency } from '../../../shared/helpers/index.js';
import type { StrictLedgerProto } from '../../../shared/types/index.js';
import { executionAmountInCurrency } from '../../foreign-securities/helpers/match-security-executions.helper.js';
import { tryToSecurityTradeType } from '../../foreign-securities/helpers/security-execution-enums.helper.js';
import { extractTransactionSecurityKeys } from '../../foreign-securities/helpers/security-key.helper.js';
import type { SecurityExecutionRow } from '../../foreign-securities/types.js';
import { LedgerError } from './utils.helper.js';

/**
 * Building blocks of the foreign-securities ledger. The base entry of a cash movement books the
 * bank account against the securities account; once the matched execution says what the movement
 * was, income and redemptions are reshaped from it here.
 */

/** Below this, an amount is float noise rather than a line worth storing */
const MIN_AMOUNT = 0.005;

/** How far apart the reported and the deduced withheld tax may be before it is flagged */
const TAX_TOLERANCE = 0.01;

export type SecuritiesExecutionKind = 'DIVIDEND' | 'INTEREST' | 'REDEMPTION' | 'OTHER';

/** What the ledger does with a cash movement, by the execution behind it */
export function classifySecurityExecution(
  execution: Pick<SecurityExecutionRow, 'trade_type'>,
): SecuritiesExecutionKind {
  switch (tryToSecurityTradeType(execution.trade_type)) {
    case SecurityTradeType.DividendPayment:
      return 'DIVIDEND';
    case SecurityTradeType.InterestPayment:
      return 'INTEREST';
    case SecurityTradeType.Redemption:
      return 'REDEMPTION';
    default:
      return 'OTHER';
  }
}

export type SecurityLocality = 'LOCAL' | 'FOREIGN';

/** ISO 3166-1 alpha-2, as the bank reports the issuer country and as an ISIN starts */
const LOCAL_COUNTRY_CODE = 'IL';

/**
 * Whether income from a security is local or foreign, by where its issuer is: a dividend of an
 * Israeli company listed abroad is still a local dividend. Falls back to the ISIN's country prefix.
 */
export function getSecurityLocality(
  execution: Pick<SecurityExecutionRow, 'issuer_country_code' | 'isin'>,
): SecurityLocality | null {
  const issuerCountry = execution.issuer_country_code?.trim().toUpperCase();
  const isinCountry = execution.isin?.trim().slice(0, 2).toUpperCase();
  const country =
    issuerCountry || (isinCountry && /^[A-Z]{2}$/.test(isinCountry) ? isinCountry : '');
  if (!country) {
    return null;
  }
  return country === LOCAL_COUNTRY_CODE ? 'LOCAL' : 'FOREIGN';
}

export const INCOME_TAX_CATEGORY_KEYS = {
  DIVIDEND: { LOCAL: 'LOCAL_DIVIDEND_INCOME', FOREIGN: 'FOREIGN_DIVIDEND_INCOME' },
  INTEREST: { LOCAL: 'LOCAL_BOND_INTEREST_INCOME', FOREIGN: 'FOREIGN_BOND_INTEREST_INCOME' },
} as const satisfies Record<
  'DIVIDEND' | 'INTEREST',
  Record<SecurityLocality, SecuritiesTaxCategoryKey>
>;

export const WITHHOLDING_TAX_CATEGORY_KEYS = {
  DIVIDEND: {
    LOCAL: 'LOCAL_DIVIDEND_WITHHOLDING_TAX',
    FOREIGN: 'FOREIGN_DIVIDEND_WITHHOLDING_TAX',
  },
  INTEREST: { LOCAL: 'LOCAL_BOND_WITHHOLDING_TAX', FOREIGN: 'FOREIGN_BOND_WITHHOLDING_TAX' },
  // tax withheld on a redemption is withheld on a bond
  REDEMPTION: { LOCAL: 'LOCAL_BOND_WITHHOLDING_TAX', FOREIGN: 'FOREIGN_BOND_WITHHOLDING_TAX' },
} as const satisfies Record<
  Exclude<SecuritiesExecutionKind, 'OTHER'>,
  Record<SecurityLocality, SecuritiesTaxCategoryKey>
>;

export type WithheldTaxExecution = Pick<
  SecurityExecutionRow,
  | 'trade_currency'
  | 'settlement_currency'
  | 'net_value_trade_currency'
  | 'net_value_settlement_currency'
  | 'net_value_nis'
  | 'trade_gross_value_trade_currency'
  | 'foreign_tax_value_settlement_currency'
  | 'israel_tax_value_by_payments_settlement_currency'
  | 'capital_tax_value_settlement_currency'
>;

function toAmount(value: string | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function currencyOfLabel(label: string | null): Currency | null {
  return label?.trim() ? formatCurrency(label, true) : null;
}

/**
 * The tax withheld from an execution's cash leg, in the cash leg's currency.
 *
 * The bank reports it as foreign and Israeli tax, signed — a refund of earlier withholding is
 * negative — and in the settlement currency, which the scraper guarantees is the trade currency
 * too. Its capital tax column restates the Israeli tax rather than adding to it, so it only stands
 * in when the Israeli column is empty. That reported amount is what gets booked; gross minus net is
 * the same figure worked out from the values, and `isConsistent` says whether the two agree.
 */
export function getWithheldTax(
  execution: WithheldTaxExecution,
  cashCurrency: Currency,
): { withheld: number; deduced: number | null; isConsistent: boolean } {
  const settlementCurrency =
    currencyOfLabel(execution.settlement_currency) ?? currencyOfLabel(execution.trade_currency);
  if (settlementCurrency !== cashCurrency) {
    throw new LedgerError(
      `The security execution settled in ${settlementCurrency ?? 'an unknown currency'} while the cash moved in ${cashCurrency}: its withheld tax cannot be read in ${cashCurrency}`,
    );
  }

  const israelTax =
    toAmount(execution.israel_tax_value_by_payments_settlement_currency) ||
    toAmount(execution.capital_tax_value_settlement_currency);
  const withheld = toAmount(execution.foreign_tax_value_settlement_currency) + israelTax;

  const net = executionAmountInCurrency(execution, cashCurrency);
  const deduced =
    execution.trade_gross_value_trade_currency == null ||
    net == null ||
    currencyOfLabel(execution.trade_currency) !== cashCurrency
      ? null
      : toAmount(execution.trade_gross_value_trade_currency) - Math.abs(toAmount(net));

  return {
    withheld,
    deduced,
    isConsistent: deduced == null || Math.abs(withheld - deduced) <= TAX_TOLERANCE,
  };
}

/**
 * The cash received, as the base entry carries it: in the transaction currency, plus its local
 * value. Amounts on new lines are converted at the same rate, so every line of the entry agrees.
 */
function cashLegOf(base: StrictLedgerProto) {
  if (!base.isCreditorCounterparty) {
    throw new LedgerError(
      `Expected money coming in for "${base.description ?? base.id}", but it went out`,
    );
  }
  const local = base.localCurrencyDebitAmount1;
  const foreign = base.debitAmount1;
  if (foreign == null) {
    return { amount: local, local, isForeign: false, toLocal: (amount: number) => amount };
  }
  if (!foreign) {
    throw new LedgerError(`Cannot price a zero amount for "${base.description ?? base.id}"`);
  }
  const rate = local / foreign;
  return { amount: foreign, local, isForeign: true, toLocal: (amount: number) => amount * rate };
}

type SecondaryLine = { accountId: string; amount: number };

/**
 * Rebuilds an entry around its cash debit: optional second lines on each side, and the main
 * credit as whatever balances them — computed, not passed in, so the entry balances exactly.
 */
function withSecondaryLines(
  base: StrictLedgerProto,
  creditAccountID1: string,
  { debit2, credit2 }: { debit2?: SecondaryLine; credit2?: SecondaryLine },
): StrictLedgerProto {
  const leg = cashLegOf(base);
  const significant = (line?: SecondaryLine) =>
    line && Math.abs(line.amount) >= MIN_AMOUNT ? line : undefined;
  const debit = significant(debit2);
  const credit = significant(credit2);

  const debitLocal2 = debit ? leg.toLocal(debit.amount) : 0;
  const creditLocal2 = credit ? leg.toLocal(credit.amount) : 0;

  return {
    ...base,
    creditAccountID1,
    creditAmount1: leg.isForeign
      ? leg.amount + (debit?.amount ?? 0) - (credit?.amount ?? 0)
      : undefined,
    localCurrencyCreditAmount1: leg.local + debitLocal2 - creditLocal2,
    debitAccountID2: debit?.accountId,
    debitAmount2: debit && leg.isForeign ? debit.amount : undefined,
    localCurrencyDebitAmount2: debit ? debitLocal2 : undefined,
    creditAccountID2: credit?.accountId,
    creditAmount2: credit && leg.isForeign ? credit.amount : undefined,
    localCurrencyCreditAmount2: credit ? creditLocal2 : undefined,
  };
}

function withholdingLine(
  withheldTax: number,
  withholdingTaxCategoryId: string | undefined,
): { debit2?: SecondaryLine; credit2?: SecondaryLine } {
  if (Math.abs(withheldTax) < MIN_AMOUNT) {
    return {};
  }
  if (!withholdingTaxCategoryId) {
    throw new LedgerError('A withholding tax category is required to book withheld tax');
  }
  const line = { accountId: withholdingTaxCategoryId, amount: Math.abs(withheldTax) };
  // withheld tax is an asset (a prepayment); a refund of it reduces that asset
  return withheldTax > 0 ? { debit2: line } : { credit2: line };
}

/**
 * Dividend or bond interest: the bank debit stays as it is (the net received), the income is
 * credited with the gross, and the withheld tax goes on a second line.
 */
export function buildIncomeEntry(
  base: StrictLedgerProto,
  params: {
    incomeTaxCategoryId: string;
    withholdingTaxCategoryId?: string;
    withheldTax: number;
  },
): StrictLedgerProto {
  return withSecondaryLines(
    base,
    params.incomeTaxCategoryId,
    withholdingLine(params.withheldTax, params.withholdingTaxCategoryId),
  );
}

/** Gross proceeds (net received plus tax withheld) less what the redeemed units cost */
export function calculateRedemptionGain(
  base: StrictLedgerProto,
  params: { costForeign: number; withheldTax: number },
): number {
  return cashLegOf(base).amount + params.withheldTax - params.costForeign;
}

/**
 * Bond redemption: the bank debit stays as it is, the securities account is credited with the
 * FIFO purchase cost (in the cash currency, at the redemption day's rate) and the difference is a
 * gain (second credit) or a loss (second debit). Tax withheld from the proceeds is a second debit,
 * so it cannot be booked together with a loss.
 */
export function buildRedemptionEntry(
  base: StrictLedgerProto,
  params: {
    costForeign: number;
    withheldTax: number;
    gainTaxCategoryId?: string;
    lossTaxCategoryId?: string;
    withholdingTaxCategoryId?: string;
  },
): StrictLedgerProto {
  const withholding = withholdingLine(params.withheldTax, params.withholdingTaxCategoryId);
  const gain = calculateRedemptionGain(base, {
    costForeign: params.costForeign,
    withheldTax: withholding.debit2?.amount ?? -(withholding.credit2?.amount ?? 0),
  });

  let gainOrLoss: { debit2?: SecondaryLine; credit2?: SecondaryLine } = {};
  if (gain >= MIN_AMOUNT) {
    if (!params.gainTaxCategoryId) {
      throw new LedgerError('A gain tax category is required to book a redemption gain');
    }
    gainOrLoss = { credit2: { accountId: params.gainTaxCategoryId, amount: gain } };
  } else if (gain <= -MIN_AMOUNT) {
    if (!params.lossTaxCategoryId) {
      throw new LedgerError('A loss tax category is required to book a redemption loss');
    }
    gainOrLoss = { debit2: { accountId: params.lossTaxCategoryId, amount: -gain } };
  }

  if ((withholding.debit2 && gainOrLoss.debit2) || (withholding.credit2 && gainOrLoss.credit2)) {
    throw new LedgerError(
      `Booking "${base.description ?? base.id}" needs a third account on one side (withheld tax together with a ${gainOrLoss.debit2 ? 'loss' : 'gain'}), which is not supported yet`,
    );
  }

  return withSecondaryLines(base, base.creditAccountID1, { ...withholding, ...gainOrLoss });
}

export type CommissionExecution = Pick<
  SecurityExecutionRow,
  | 'security'
  | 'trade_currency'
  | 'commissions_currency'
  | 'trade_commission_value_nis'
  | 'trade_commission_value_trade_currency'
>;

/**
 * The fee transaction the bank should have posted for an execution's commission, signed as the
 * cash moves: an ordinary commission is money out, and a cancelled execution's negated commission
 * is a refund coming back in.
 *
 * The commission is not part of the execution's net value — the bank charges it separately, as a
 * fee row of its own in the commission currency (shekels, for the executions seen so far). Null
 * when there is no commission, or it is in a currency the execution does not report a value for.
 */
export function getExpectedCommissionCharge(
  execution: CommissionExecution,
): { currency: Currency; amount: number } | null {
  const currency = currencyOfLabel(execution.commissions_currency);
  if (!currency) {
    return null;
  }

  let commission: number;
  if (currency === Currency.Ils) {
    commission = toAmount(execution.trade_commission_value_nis);
  } else if (currencyOfLabel(execution.trade_currency) === currency) {
    commission = toAmount(execution.trade_commission_value_trade_currency);
  } else {
    return null;
  }

  return Math.abs(commission) < MIN_AMOUNT ? null : { currency, amount: -commission };
}

export type CommissionFeeTransaction = {
  amount: string;
  currency: string;
  source_description: string | null;
  source_reference: string | null;
};

export type CommissionMismatch<TExecution extends CommissionExecution> = {
  /** The executions of the security whose commissions were added up */
  executions: TExecution[];
  currency: Currency;
  /** What the bank reported, signed as the fee should move */
  expected: number;
  /** What the charge's fee transactions for the security add up to */
  charged: number;
};

/**
 * Whether each security's reported commission was actually charged: the executions' expected fee
 * charges against the charge's fee transactions, per security and currency.
 *
 * A fee transaction names its security in its reference (see `extractTransactionSecurityKeys`);
 * one that names none cannot be attributed and is left out. Fees of securities with no expected
 * commission are not this check's business either — they are booked as fees regardless.
 *
 * Every fee of a security is added up, so every execution of that security in the charge has to
 * be passed in — a bond's coupon and its redemption each bring a fee of their own. Which mismatches
 * are worth reporting is the caller's call.
 */
export function validateSecurityCommissions<TExecution extends CommissionExecution>(
  executions: readonly TExecution[],
  feeTransactions: readonly CommissionFeeTransaction[],
): CommissionMismatch<TExecution>[] {
  const groupKey = (security: string, currency: Currency) => `${security}:${currency}`;

  const expectedByGroup = new Map<string, CommissionMismatch<TExecution>>();
  for (const execution of executions) {
    const charge = getExpectedCommissionCharge(execution);
    if (!charge) {
      continue;
    }
    const key = groupKey(execution.security, charge.currency);
    const group = expectedByGroup.get(key);
    if (group) {
      group.executions.push(execution);
      group.expected += charge.amount;
    } else {
      expectedByGroup.set(key, {
        executions: [execution],
        currency: charge.currency,
        expected: charge.amount,
        charged: 0,
      });
    }
  }

  for (const fee of feeTransactions) {
    const currency = formatCurrency(fee.currency, true);
    if (!currency) {
      continue;
    }
    for (const security of extractTransactionSecurityKeys(fee)) {
      const group = expectedByGroup.get(groupKey(security, currency));
      if (group) {
        group.charged += toAmount(fee.amount);
        break;
      }
    }
  }

  return [...expectedByGroup.values()].filter(
    group => Math.abs(group.expected - group.charged) > TAX_TOLERANCE,
  );
}
