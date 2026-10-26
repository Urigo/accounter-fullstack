import type { SecuritiesTaxCategoryKey } from '../../../__generated__/types.js';
import { Currency, SecurityTradeType } from '../../../shared/enums.js';
import { formatCurrency } from '../../../shared/helpers/index.js';
import type { StrictLedgerProto } from '../../../shared/types/index.js';
import { executionAmountInCurrency } from '../../foreign-securities/helpers/match-security-executions.helper.js';
import {
  currencyOfSecurityLabel,
  isCancelledExecution,
  isDividendInKindDistribution,
  tryToSecurityTradeType,
} from '../../foreign-securities/helpers/security-execution-enums.helper.js';
import { extractTransactionSecurityKeys } from '../../foreign-securities/helpers/security-key.helper.js';
import type { SecurityLocality } from '../../foreign-securities/helpers/security-locality.helper.js';
import type { SecurityExecutionRow } from '../../foreign-securities/types.js';
import { LedgerError } from './utils.helper.js';

export { isDividendInKindDistribution };

/**
 * Building blocks of the foreign-securities ledger. The base entry of a cash movement books the
 * bank account against the securities account; once the matched execution says what the movement
 * was, income, sales and redemptions are reshaped from it here.
 */

/** Below this, an amount is float noise rather than a line worth storing */
const MIN_AMOUNT = 0.005;

/** How far apart the reported and the deduced withheld tax may be before it is flagged */
const TAX_TOLERANCE = 0.01;

export type SecuritiesExecutionKind = 'DIVIDEND' | 'INTEREST' | 'SALE' | 'REDEMPTION' | 'OTHER';

/** What the ledger does with a cash movement, by the execution behind it */
export function classifySecurityExecution(
  execution: Pick<SecurityExecutionRow, 'trade_type'>,
): SecuritiesExecutionKind {
  switch (tryToSecurityTradeType(execution.trade_type)) {
    case SecurityTradeType.DividendPayment:
      return 'DIVIDEND';
    case SecurityTradeType.InterestPayment:
      return 'INTEREST';
    case SecurityTradeType.Sell:
      return 'SALE';
    case SecurityTradeType.Redemption:
      return 'REDEMPTION';
    default:
      return 'OTHER';
  }
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
  // tax withheld on a sale is not booked yet
  Exclude<SecuritiesExecutionKind, 'OTHER' | 'SALE'>,
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
  | 'is_cancel_transaction'
>;

export function toAmount(value: string | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export const currencyOfLabel = currencyOfSecurityLabel;

/**
 * The tax withheld from an execution's cash leg, in the cash leg's currency.
 *
 * The bank reports it as foreign and Israeli tax, signed — a refund of earlier withholding is
 * negative — and in the settlement currency, which the scraper guarantees is the trade currency
 * too. Its capital tax column restates the Israeli tax rather than adding to it, so it only stands
 * in when the Israeli column is empty. That reported amount is what gets booked; gross minus net is
 * the same figure worked out from the values, and `isConsistent` says whether the two agree.
 *
 * A cancellation reverses the cash: the bank keeps its gross positive but reports its net and tax
 * negated, so the deduced figure is negated too, to compare with the reported one.
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
      : (isCancelledExecution(execution) ? -1 : 1) *
        (Math.abs(toAmount(execution.trade_gross_value_trade_currency)) - Math.abs(toAmount(net)));

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

/** The same entry seen from the other side: every debit becomes a credit and vice versa */
function mirrorEntry(entry: StrictLedgerProto): StrictLedgerProto {
  return {
    ...entry,
    debitAccountID1: entry.creditAccountID1,
    debitAmount1: entry.creditAmount1,
    localCurrencyDebitAmount1: entry.localCurrencyCreditAmount1,
    debitAccountID2: entry.creditAccountID2,
    debitAmount2: entry.creditAmount2,
    localCurrencyDebitAmount2: entry.localCurrencyCreditAmount2,
    creditAccountID1: entry.debitAccountID1,
    creditAmount1: entry.debitAmount1,
    localCurrencyCreditAmount1: entry.localCurrencyDebitAmount1,
    creditAccountID2: entry.debitAccountID2,
    creditAmount2: entry.debitAmount2,
    localCurrencyCreditAmount2: entry.localCurrencyDebitAmount2,
    isCreditorCounterparty: !entry.isCreditorCounterparty,
  };
}

/**
 * A cancelled dividend or bond interest payment: the mirror of the income entry it reverses. The
 * bank is credited with the net paid back, the income is debited with the gross, and the withheld
 * tax — reported negated on the cancellation — is credited back on a second line.
 */
export function buildIncomeReversalEntry(
  base: StrictLedgerProto,
  params: {
    incomeTaxCategoryId: string;
    withholdingTaxCategoryId?: string;
    /** As the bank reports it on the cancellation: negative when it reverses withheld tax */
    withheldTax: number;
  },
): StrictLedgerProto {
  if (base.isCreditorCounterparty) {
    throw new LedgerError(
      `Expected money going out for the cancellation "${base.description ?? base.id}", but it came in`,
    );
  }
  return mirrorEntry(
    buildIncomeEntry(mirrorEntry(base), { ...params, withheldTax: -params.withheldTax }),
  );
}

/**
 * Prices a foreign-currency base entry at the given rate instead of its own day's: both sides of
 * its line are revalued from their foreign amounts, and the entry carries the pricing it took. Its
 * value date stays, so it is still booked on the day the cash moved.
 */
export function priceEntryAtRate(
  entry: StrictLedgerProto,
  rate: number,
  pricing: Pick<StrictLedgerProto, 'exchangeRateDate' | 'currencyRate'>,
): StrictLedgerProto {
  if (entry.debitAmount1 == null || entry.creditAmount1 == null) {
    throw new LedgerError(
      `Cannot reprice "${entry.description ?? entry.id}": it has no foreign-currency amounts`,
    );
  }
  return {
    ...entry,
    localCurrencyDebitAmount1: entry.debitAmount1 * rate,
    localCurrencyCreditAmount1: entry.creditAmount1 * rate,
    exchangeRateDate: pricing.exchangeRateDate,
    currencyRate: pricing.currencyRate,
  };
}

export type CancelledPaymentExecution = Pick<
  SecurityExecutionRow,
  | 'id'
  | 'security'
  | 'trade_type'
  | 'trade_date'
  | 'trade_gross_value_trade_currency'
  | 'is_cancel_transaction'
>;

/**
 * The payment a cancelled execution cancels, among the executions it is booked with, or null when
 * none of them is it.
 *
 * The bank reports a cancellation as a row of its own with the original's security, trade type and
 * gross. It is paired with the latest such live execution at or before it, as a cancelled
 * distribution is (`findDistributionCancellation`); of two on the same day, with the later one.
 */
export function findCancelledPayment<T extends CancelledPaymentExecution>(
  cancellation: T,
  candidates: readonly T[],
): T | null {
  const gross = Math.abs(toAmount(cancellation.trade_gross_value_trade_currency));
  let original: T | null = null;
  for (const candidate of candidates) {
    if (
      candidate.id === cancellation.id ||
      isCancelledExecution(candidate) ||
      candidate.security !== cancellation.security ||
      candidate.trade_type !== cancellation.trade_type ||
      Math.abs(Math.abs(toAmount(candidate.trade_gross_value_trade_currency)) - gross) >=
        MIN_AMOUNT ||
      candidate.trade_date > cancellation.trade_date
    ) {
      continue;
    }
    if (
      !original ||
      candidate.trade_date > original.trade_date ||
      (candidate.trade_date === original.trade_date && candidate.id > original.id)
    ) {
      original = candidate;
    }
  }
  return original;
}

/**
 * The price PnL of a disposal (a sale or a redemption), in the cash currency: gross proceeds (net
 * received plus tax withheld) less what the units cost
 */
export function calculateDisposalGain(
  base: StrictLedgerProto,
  params: { costForeign: number; withheldTax: number },
): number {
  return cashLegOf(base).amount + params.withheldTax - params.costForeign;
}

/**
 * A disposal — a sale, or a bond redemption: the bank debit stays as it is, the securities account
 * is credited with the FIFO purchase cost (in the cash currency, at the cash leg's rate) and the
 * difference is the price gain (second credit) or loss (second debit). Tax withheld from the
 * proceeds is a second debit, so it cannot be booked together with a loss.
 *
 * Crediting the cost at the cash leg's rate leaves the securities account's local balance off by
 * the rate PnL; `buildSaleRevaluationEntry` books that.
 */
export function buildDisposalEntry(
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
  const gain = calculateDisposalGain(base, {
    costForeign: params.costForeign,
    withheldTax: withholding.debit2?.amount ?? -(withholding.credit2?.amount ?? 0),
  });

  let gainOrLoss: { debit2?: SecondaryLine; credit2?: SecondaryLine } = {};
  if (gain >= MIN_AMOUNT) {
    if (!params.gainTaxCategoryId) {
      throw new LedgerError('A gain tax category is required to book a disposal gain');
    }
    gainOrLoss = { credit2: { accountId: params.gainTaxCategoryId, amount: gain } };
  } else if (gain <= -MIN_AMOUNT) {
    if (!params.lossTaxCategoryId) {
      throw new LedgerError('A loss tax category is required to book a disposal loss');
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

/**
 * The rate PnL of a disposal: the disposal entry credits the securities account with the units'
 * cost at the cash leg's rate, while the account carries them at the rate they were booked at, or
 * revalued to at the last year-end. This local-currency entry books the difference, so the account
 * gives up exactly what it carried the units at:
 * - a gain (the cost is worth more now): Dr securities account, Cr exchange gain
 * - a loss: Dr exchange loss, Cr securities account
 *
 * Null when there is nothing worth booking.
 */
export function buildSaleRevaluationEntry(
  /** The disposal entry, whose first credit is the securities account */
  disposal: StrictLedgerProto,
  params: {
    /** Σ lot cost × (cash leg's rate − lot's carrying rate) */
    ratePnL: number;
    exchangeGainTaxCategoryId?: string;
    exchangeLossTaxCategoryId?: string;
    localCurrency: Currency;
    description: string;
  },
): StrictLedgerProto | null {
  const { ratePnL } = params;
  if (Math.abs(ratePnL) < MIN_AMOUNT) {
    return null;
  }
  const isGain = ratePnL > 0;
  const exchangeAccountId = isGain
    ? params.exchangeGainTaxCategoryId
    : params.exchangeLossTaxCategoryId;
  if (!exchangeAccountId) {
    throw new LedgerError(
      `An exchange ${isGain ? 'gain' : 'loss'} tax category is required to book the rate PnL of "${disposal.description ?? disposal.id}"`,
    );
  }
  const securitiesAccountId = disposal.creditAccountID1;
  const amount = Math.abs(ratePnL);

  return {
    id: `${disposal.id}|sale-revaluation`, // NOTE: this field is dummy
    invoiceDate: disposal.invoiceDate,
    valueDate: disposal.valueDate,
    currency: params.localCurrency,
    debitAccountID1: isGain ? securitiesAccountId : exchangeAccountId,
    localCurrencyDebitAmount1: amount,
    creditAccountID1: isGain ? exchangeAccountId : securitiesAccountId,
    localCurrencyCreditAmount1: amount,
    description: params.description,
    reference: disposal.reference,
    // the securities account is the counterparty, credited on a loss
    isCreditorCounterparty: !isGain,
    ownerId: disposal.ownerId,
    chargeId: disposal.chargeId,
  };
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

export type DistributionExecution = Pick<
  SecurityExecutionRow,
  | 'id'
  | 'security'
  | 'symbol'
  | 'isin'
  | 'nv'
  | 'trade_date'
  | 'value_date'
  | 'trade_currency'
  | 'trade_gross_value_trade_currency'
  | 'trade_gross_value_nis'
  | 'personal_currency_rate'
  | 'foreign_tax_value_settlement_currency'
  | 'israel_tax_value_by_payments_settlement_currency'
  | 'capital_tax_value_settlement_currency'
>;

/**
 * The tax the bank reports withheld on a distribution, read straight off its tax columns, as
 * `getWithheldTax` reads them: the capital tax column restates the Israeli one, so it only stands
 * in when that is empty.
 *
 * Not `getWithheldTax` itself: a distribution has no cash leg to read the tax in, and its net value
 * columns hold the commission rather than what was received, so gross minus net says nothing.
 */
export function getDistributionWithheldTax(execution: DistributionExecution): number {
  const israelTax =
    toAmount(execution.israel_tax_value_by_payments_settlement_currency) ||
    toAmount(execution.capital_tax_value_settlement_currency);
  return toAmount(execution.foreign_tax_value_settlement_currency) + israelTax;
}

/** The date a distribution is booked on: its value date, or the trade date when there is none */
export function distributionValueDate(execution: DistributionExecution) {
  return execution.value_date ?? execution.trade_date;
}

/**
 * A dividend in kind: the shares received are debited to the securities account and credited to
 * dividend income, at their gross value in the trade currency and the ledger's rate.
 *
 * The gross value, not the net: on a distribution the net value columns hold the commission the
 * bank charged for it, not the value of the shares.
 */
export function buildDistributionEntry(params: {
  execution: DistributionExecution;
  /** The securities account's tax category in the trade currency */
  securitiesTaxCategoryId: string;
  incomeTaxCategoryId: string;
  currency: Currency;
  defaultLocalCurrency: Currency;
  /** The ledger's rate from the trade currency to the local one; 1 for a local-currency trade */
  rate: number;
  ownerId: string;
  chargeId: string;
}): StrictLedgerProto {
  const { execution, currency, defaultLocalCurrency, rate } = params;
  const gross = toAmount(execution.trade_gross_value_trade_currency);
  if (gross <= 0) {
    throw new LedgerError(
      `The stock distribution of ${execution.symbol ?? execution.security} on ${execution.trade_date} reports no value for the shares received`,
    );
  }
  const isForeign = currency !== defaultLocalCurrency;
  const local = isForeign ? gross * rate : gross;
  const valueDate = distributionValueDate(execution);
  const name = execution.symbol?.trim() || execution.security;

  return {
    id: execution.id,
    invoiceDate: execution.trade_date,
    valueDate,
    exchangeRateDate: valueDate,
    currency,
    debitAccountID1: params.securitiesTaxCategoryId,
    debitAmount1: isForeign ? gross : undefined,
    localCurrencyDebitAmount1: local,
    creditAccountID1: params.incomeTaxCategoryId,
    creditAmount1: isForeign ? gross : undefined,
    localCurrencyCreditAmount1: local,
    description: `Stock distribution: ${Number(execution.nv ?? 0)} × ${name}`,
    reference: execution.security,
    isCreditorCounterparty: true,
    ownerId: params.ownerId,
    currencyRate: isForeign ? rate : undefined,
    chargeId: params.chargeId,
  };
}

/**
 * How far the ledger's rate may be from the bank's before it is reported. The Bank of Israel
 * publishes three decimals, and so does the bank's own rate, so any difference at that precision
 * means the two used different rates.
 */
const RATE_TOLERANCE = 0.0005;

/** How far each of the bank's reported amounts can be from its unrounded value */
const AMOUNT_ROUNDING = 0.005;

/**
 * The bank's rate from the trade currency to the local one, as it priced a distribution: its own
 * rate column when reported (it writes -1 for "no rate"), or else its local value over its
 * trade-currency value — `derived`, since both of those amounts are rounded. Null when neither is
 * usable.
 */
export function getBankDistributionRate(
  execution: DistributionExecution,
): { rate: number; derived: boolean } | null {
  const personalRate = toAmount(execution.personal_currency_rate);
  if (personalRate > 0) {
    return { rate: personalRate, derived: false };
  }
  const gross = toAmount(execution.trade_gross_value_trade_currency);
  const grossLocal = toAmount(execution.trade_gross_value_nis);
  return gross > 0 && grossLocal > 0 ? { rate: grossLocal / gross, derived: true } : null;
}

/**
 * Whether the ledger priced a foreign-currency distribution at a different rate than the bank
 * did. Rates are compared rather than local amounts: the bank works its local value out from the
 * unrounded units times price, so its amount differs from gross times rate by a few agorot even
 * when the rates agree.
 *
 * A rate derived from the two rounded amounts carries that rounding too, magnified on a small
 * distribution, so its tolerance widens by the most the rounding can move it: half an agora on the
 * local value and half a cent on the gross (worth `rate` agorot), over the gross.
 */
export function getBankRateMismatch(
  execution: DistributionExecution,
  ledgerRate: number,
): { ledgerRate: number; bankRate: number } | null {
  const bankRate = getBankDistributionRate(execution);
  if (bankRate == null) {
    return null;
  }
  const gross = toAmount(execution.trade_gross_value_trade_currency);
  const tolerance = bankRate.derived
    ? RATE_TOLERANCE + (AMOUNT_ROUNDING * (bankRate.rate + 1)) / gross
    : RATE_TOLERANCE;
  if (Math.abs(bankRate.rate - ledgerRate) <= tolerance) {
    return null;
  }
  return { ledgerRate, bankRate: bankRate.rate };
}

export type DistributionHistoryExecution = Pick<
  SecurityExecutionRow,
  'id' | 'trade_date' | 'trade_type' | 'payment_type' | 'nv' | 'is_cancel_transaction'
>;

/**
 * The cancellation of a stock distribution among the executions of its security and account, or
 * null when the bank never cancelled it.
 *
 * A cancellation is a row of its own with the same trade and payment type and units, dated on or
 * after the distribution it reverses. It is paired with the latest such live distribution at or
 * before it, so of two same-size distributions a year apart, cancelling the later one does not
 * reverse the earlier. Ingestion skips cancelled distributions by the same rule
 * (`getUnlinkedDistributions`).
 */
export function findDistributionCancellation<T extends DistributionHistoryExecution>(
  distribution: T,
  history: readonly T[],
): T | null {
  const units = Math.abs(Number(distribution.nv));
  const sameKind = (row: T) =>
    row.trade_type === distribution.trade_type &&
    (row.payment_type ?? null) === (distribution.payment_type ?? null) &&
    Math.abs(Number(row.nv)) === units;
  const isAfterDistribution = (row: T) =>
    row.trade_date > distribution.trade_date ||
    (row.trade_date === distribution.trade_date && row.id > distribution.id);

  return (
    history.find(
      cancellation =>
        cancellation.id !== distribution.id &&
        isCancelledExecution(cancellation) &&
        sameKind(cancellation) &&
        cancellation.trade_date >= distribution.trade_date &&
        // no later live distribution of the same kind it would reverse instead
        !history.some(
          other =>
            !isCancelledExecution(other) &&
            sameKind(other) &&
            isAfterDistribution(other) &&
            other.trade_date <= cancellation.trade_date,
        ),
    ) ?? null
  );
}
