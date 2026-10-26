import { timelessDateFromParts } from '../../../shared/helpers/timeless-date.js';
import type { TimelessDateString } from '../../../shared/types/index.js';

/*
 * The arithmetic of a company's semi-annual securities report (Income Tax Ordinance s.91(d)(2c)):
 * pure, so every rule is tested on its own. The data is gathered by
 * `securities-semi-annual-report-data.helper.ts`.
 *
 * What is reported, after the Tax Authority's guidance (July 2006) and the accountant's letter:
 * the half's sales turnover, its real capital gains and losses, its dividend and interest income,
 * the tax on them and the advance due. A company pays the regular corporate tax rate on all of it
 * (s.91(a), s.126(a)), except for local dividends, which are exempt (s.126(b)).
 */

export type YearHalf = 'H1' | 'H2';
export type SecuritiesIncomeKind = 'DIVIDEND' | 'INTEREST';
export type SecuritiesIncomeLocality = 'LOCAL' | 'FOREIGN';
export type SemiAnnualAdvanceNote =
  | 'CAPITAL_GAINS_OFFSET_BY_CARRIED_FORWARD_LOSSES'
  | 'CAPITAL_LOSS_IN_PERIOD'
  | 'INCOME_TAX_COVERED_BY_FOREIGN_TAX'
  | 'LIABILITY_COVERED_BY_WITHHOLDING'
  | 'NO_TAXABLE_EVENTS';

export type SemiAnnualPeriod = {
  year: number;
  half: YearHalf;
  fromDate: TimelessDateString;
  toDate: TimelessDateString;
  /** The day the report and the advance are due */
  dueDate: TimelessDateString;
};

/**
 * The days a half covers and the day it is reported on: 31 July for January–June, and 31 January
 * of the next year for July–December (s.91(d)(2c)(b)).
 */
export function getSemiAnnualPeriod(year: number, half: YearHalf): SemiAnnualPeriod {
  return half === 'H1'
    ? {
        year,
        half,
        fromDate: timelessDateFromParts(year, 1, 1),
        toDate: timelessDateFromParts(year, 6, 30),
        dueDate: timelessDateFromParts(year, 7, 31),
      }
    : {
        year,
        half,
        fromDate: timelessDateFromParts(year, 7, 1),
        toDate: timelessDateFromParts(year, 12, 31),
        dueDate: timelessDateFromParts(year + 1, 1, 31),
      };
}

/** A sale or redemption, in ILS */
export type SemiAnnualSaleFigures = {
  consideration: number;
  /** The real gain, or the (nominal) loss when negative; null when it cannot be worked out */
  realGain: number | null;
  inflationaryAmount: number;
  israeliTaxWithheld: number;
};

/** A dividend or interest ledger record, in ILS */
export type SemiAnnualIncomeFigures = {
  kind: SecuritiesIncomeKind;
  locality: SecuritiesIncomeLocality;
  gross: number;
  foreignTaxWithheld: number;
  israeliTaxWithheld: number;
};

/** A half's sales, totalled in whole shekels */
export type SemiAnnualSalesSummary = {
  /** (a) The consideration of every sale, including those whose gain is unknown */
  salesTurnover: number;
  /** (b) The real gains of the sales that ended in a gain */
  totalRealGains: number;
  /** (c) The losses of the sales that ended in a loss, as a positive amount */
  totalLosses: number;
  /** Gains less losses: negative on a net loss */
  netRealCapitalGain: number;
  inflationaryAmount: number;
  israeliTaxWithheld: number;
  saleCount: number;
};

/** Each line is rounded to whole shekels before anything is derived from it, so the sheet adds up */
const shekels = (amount: number) => {
  const rounded = Math.round(amount);
  return Object.is(rounded, -0) ? 0 : rounded;
};

const sum = (amounts: readonly number[]) => amounts.reduce((total, amount) => total + amount, 0);

export function summarizeSemiAnnualSales(
  sales: readonly SemiAnnualSaleFigures[],
): SemiAnnualSalesSummary {
  const gains = sales.map(sale => sale.realGain ?? 0);
  const totalRealGains = shekels(sum(gains.filter(gain => gain > 0)));
  const totalLosses = shekels(-sum(gains.filter(gain => gain < 0)));
  return {
    salesTurnover: shekels(sum(sales.map(sale => sale.consideration))),
    totalRealGains,
    totalLosses,
    netRealCapitalGain: totalRealGains - totalLosses,
    inflationaryAmount: shekels(sum(sales.map(sale => sale.inflationaryAmount))),
    israeliTaxWithheld: shekels(sum(sales.map(sale => sale.israeliTaxWithheld))),
    saleCount: sales.length,
  };
}

/** The income buckets, in the order the report lists them */
export const SEMI_ANNUAL_INCOME_BUCKETS: readonly {
  kind: SecuritiesIncomeKind;
  locality: SecuritiesIncomeLocality;
}[] = [
  { kind: 'DIVIDEND', locality: 'LOCAL' },
  { kind: 'DIVIDEND', locality: 'FOREIGN' },
  { kind: 'INTEREST', locality: 'LOCAL' },
  { kind: 'INTEREST', locality: 'FOREIGN' },
];

/** A company is taxed on all of its securities income but local dividends (s.126(b)) */
export const isTaxableIncome = (kind: SecuritiesIncomeKind, locality: SecuritiesIncomeLocality) =>
  !(kind === 'DIVIDEND' && locality === 'LOCAL');

export type SemiAnnualIncomeSummary = {
  kind: SecuritiesIncomeKind;
  locality: SecuritiesIncomeLocality;
  gross: number;
  foreignTaxWithheld: number;
  israeliTaxWithheld: number;
  taxable: boolean;
  /** Null when there is no tax rate */
  tax: number | null;
  /** The foreign tax credited against `tax`: never more than it, nor than what was withheld */
  foreignTaxCredit: number | null;
};

export type SemiAnnualDeclaration = SemiAnnualSalesSummary & {
  priorYearsLosses: number;
  /** For the second half: the first half's net real gain, which it carries losses from */
  firstHalfNetRealCapitalGain: number | null;
  /** The carried-forward losses available to the half */
  lossesCarriedForward: number;
  /** (d) The half's net real gain after carried-forward losses; negative when losses remain */
  netRealCapitalGainAfterLosses: number;
  dividendIncome: number;
  interestIncome: number;
  incomeSummary: SemiAnnualIncomeSummary[];
  /** The tax lines are null when there is no tax rate */
  capitalGainsTax: number | null;
  dividendsTax: number | null;
  interestTax: number | null;
  grossTax: number | null;
  foreignTaxCredit: number | null;
  taxLiability: number | null;
  israeliTaxWithheldOnIncome: number;
  /** (e) The advance to pay, never below zero */
  taxAdvance: number | null;
  /** Israeli tax withheld beyond the liability */
  excessCredits: number | null;
  advanceNotes: SemiAnnualAdvanceNote[];
};

/**
 * The declaration of a half.
 *
 * - Capital gains: the half's real gains less its losses, less the capital losses carried forward
 *   (s.92(b)). In the second half, those are the prior years' losses still unused after the first
 *   half, plus the first half's own net loss: `max(0, prior − first half's net)`.
 * - Dividends and interest are taxed by bucket (kind × locality) at the same rate, local dividends
 *   excepted; the foreign tax withheld on a bucket is credited against its tax, capped at it — so
 *   excess foreign tax on one bucket does not reduce the tax on another.
 * - The liability is the gross tax less the foreign tax credit; the advance is the liability less
 *   the Israeli tax withheld at source (s.91(d)(6)), never below zero.
 *
 * Not modelled: offsetting a net securities loss against dividends and interest (s.92(a)(4)), and
 * carrying an unused foreign tax credit between halves.
 */
export function computeSemiAnnualDeclaration(params: {
  half: YearHalf;
  /** The corporate tax rate, as a fraction; null when none is set */
  taxRate: number | null;
  priorYearsLosses: number;
  sales: readonly SemiAnnualSaleFigures[];
  /** For the second half: the first half's sales, which it carries losses from */
  firstHalfSales?: readonly SemiAnnualSaleFigures[];
  income: readonly SemiAnnualIncomeFigures[];
}): SemiAnnualDeclaration {
  const { taxRate } = params;
  const salesSummary = summarizeSemiAnnualSales(params.sales);
  const priorYearsLosses = shekels(Math.max(0, params.priorYearsLosses));

  const firstHalfNetRealCapitalGain =
    params.half === 'H2'
      ? summarizeSemiAnnualSales(params.firstHalfSales ?? []).netRealCapitalGain
      : null;
  const lossesCarriedForward =
    firstHalfNetRealCapitalGain == null
      ? priorYearsLosses
      : Math.max(0, priorYearsLosses - firstHalfNetRealCapitalGain);
  const netRealCapitalGainAfterLosses = salesSummary.netRealCapitalGain - lossesCarriedForward;

  const taxOn = (amount: number) =>
    taxRate == null ? null : shekels(taxRate * Math.max(0, amount));

  const incomeSummary = SEMI_ANNUAL_INCOME_BUCKETS.map(({ kind, locality }) => {
    const records = params.income.filter(
      record => record.kind === kind && record.locality === locality,
    );
    const gross = shekels(sum(records.map(record => record.gross)));
    const foreignTaxWithheld = shekels(sum(records.map(record => record.foreignTaxWithheld)));
    const taxable = isTaxableIncome(kind, locality);
    const tax = taxable ? taxOn(gross) : taxRate == null ? null : 0;
    return {
      kind,
      locality,
      gross,
      foreignTaxWithheld,
      israeliTaxWithheld: shekels(sum(records.map(record => record.israeliTaxWithheld))),
      taxable,
      tax,
      foreignTaxCredit: tax == null ? null : Math.min(Math.max(0, foreignTaxWithheld), tax),
    } satisfies SemiAnnualIncomeSummary;
  });

  const incomeOf = (kind: SecuritiesIncomeKind) =>
    incomeSummary.filter(bucket => bucket.kind === kind);
  const dividendIncome = sum(incomeOf('DIVIDEND').map(bucket => bucket.gross));
  const interestIncome = sum(incomeOf('INTEREST').map(bucket => bucket.gross));
  const israeliTaxWithheldOnIncome = sum(incomeSummary.map(bucket => bucket.israeliTaxWithheld));

  const capitalGainsTax = taxOn(netRealCapitalGainAfterLosses);
  const declaration = {
    ...salesSummary,
    priorYearsLosses,
    firstHalfNetRealCapitalGain,
    lossesCarriedForward,
    netRealCapitalGainAfterLosses,
    dividendIncome,
    interestIncome,
    incomeSummary,
    israeliTaxWithheldOnIncome,
  };

  const hasEvents = salesSummary.saleCount > 0 || incomeSummary.some(bucket => bucket.gross !== 0);

  if (capitalGainsTax == null) {
    return {
      ...declaration,
      capitalGainsTax: null,
      dividendsTax: null,
      interestTax: null,
      grossTax: null,
      foreignTaxCredit: null,
      taxLiability: null,
      taxAdvance: null,
      excessCredits: null,
      advanceNotes: hasEvents ? [] : ['NO_TAXABLE_EVENTS'],
    };
  }

  const taxOfBuckets = (buckets: readonly SemiAnnualIncomeSummary[]) =>
    sum(buckets.map(bucket => bucket.tax ?? 0));
  const dividendsTax = taxOfBuckets(incomeOf('DIVIDEND'));
  const interestTax = taxOfBuckets(incomeOf('INTEREST'));
  const grossTax = capitalGainsTax + dividendsTax + interestTax;
  const foreignTaxCredit = sum(incomeSummary.map(bucket => bucket.foreignTaxCredit ?? 0));
  const taxLiability = grossTax - foreignTaxCredit;
  // a refund can leave the withheld tax negative; it is never a credit then
  const israeliCredits = Math.max(0, salesSummary.israeliTaxWithheld + israeliTaxWithheldOnIncome);
  const taxAdvance = Math.max(0, taxLiability - israeliCredits);

  const advanceNotes: SemiAnnualAdvanceNote[] = [];
  if (!hasEvents) {
    advanceNotes.push('NO_TAXABLE_EVENTS');
  }
  if (salesSummary.netRealCapitalGain > 0 && lossesCarriedForward > 0) {
    advanceNotes.push('CAPITAL_GAINS_OFFSET_BY_CARRIED_FORWARD_LOSSES');
  }
  if (salesSummary.saleCount > 0 && salesSummary.netRealCapitalGain < 0) {
    advanceNotes.push('CAPITAL_LOSS_IN_PERIOD');
  }
  if (dividendsTax + interestTax > 0 && foreignTaxCredit >= dividendsTax + interestTax) {
    advanceNotes.push('INCOME_TAX_COVERED_BY_FOREIGN_TAX');
  }
  if (taxLiability > 0 && israeliCredits >= taxLiability) {
    advanceNotes.push('LIABILITY_COVERED_BY_WITHHOLDING');
  }

  return {
    ...declaration,
    capitalGainsTax,
    dividendsTax,
    interestTax,
    grossTax,
    foreignTaxCredit,
    taxLiability,
    taxAdvance,
    excessCredits: Math.max(0, israeliCredits - taxLiability),
    advanceNotes,
  };
}

/** A ledger record's amounts, as far as the report reads them */
export type SemiAnnualLedgerRecord = {
  debit_entity1: string | null;
  debit_entity2: string | null;
  credit_entity1: string | null;
  credit_entity2: string | null;
  debit_local_amount1: string | null;
  debit_local_amount2: string | null;
  credit_local_amount1: string | null;
  credit_local_amount2: string | null;
  debit_foreign_amount1: string | null;
  debit_foreign_amount2: string | null;
  credit_foreign_amount1: string | null;
  credit_foreign_amount2: string | null;
};

const toNumber = (value: string | null) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

/**
 * What a ledger record moves on an entity, in local currency: its credits less its debits, over
 * all four slots. Income is credited, so it comes out positive; a reversal debits it, so it comes
 * out negative.
 */
export function ledgerEntityAmount(record: SemiAnnualLedgerRecord, entityId: string): number {
  let amount = 0;
  if (record.credit_entity1 === entityId) amount += toNumber(record.credit_local_amount1);
  if (record.credit_entity2 === entityId) amount += toNumber(record.credit_local_amount2);
  if (record.debit_entity1 === entityId) amount -= toNumber(record.debit_local_amount1);
  if (record.debit_entity2 === entityId) amount -= toNumber(record.debit_local_amount2);
  return amount;
}

/**
 * The rate a ledger record converts its foreign amounts at: local over foreign on the slot that
 * carries the entity (the income category). 1 when the record has no foreign amount there — a
 * local-currency record. Null when the slot carries a foreign amount of zero against a local one.
 */
export function ledgerRecordRate(record: SemiAnnualLedgerRecord, entityId: string): number | null {
  const slots = [
    [record.credit_entity1, record.credit_local_amount1, record.credit_foreign_amount1],
    [record.credit_entity2, record.credit_local_amount2, record.credit_foreign_amount2],
    [record.debit_entity1, record.debit_local_amount1, record.debit_foreign_amount1],
    [record.debit_entity2, record.debit_local_amount2, record.debit_foreign_amount2],
  ] as const;
  for (const [entity, local, foreign] of slots) {
    if (entity !== entityId) {
      continue;
    }
    if (foreign == null) {
      return 1;
    }
    const foreignAmount = toNumber(foreign);
    const localAmount = toNumber(local);
    if (foreignAmount === 0) {
      return localAmount === 0 ? 1 : null;
    }
    return Math.abs(localAmount / foreignAmount);
  }
  return null;
}

/** How far the split of a record's withholding may be from the record before it is flagged, in ILS */
export const WITHHOLDING_SPLIT_TOLERANCE = 1;

/**
 * A record's withholding, split into the foreign and the Israeli tax.
 *
 * The ledger books both on one withholding line; the execution behind the record reports them
 * apart, in its settlement currency. They are converted at the record's own rate, so they are in
 * the same shekels as the line. When the execution is unknown, the whole line is taken as the tax
 * its locality makes likelier — Israeli on a local security, foreign on a foreign one — and the
 * caller flags it.
 */
export function splitIncomeWithholding(params: {
  locality: SecuritiesIncomeLocality;
  /** The record's withholding line, in ILS */
  withheld: number;
  /** The execution's withheld tax in its settlement currency; null when it is unknown */
  parts: { foreign: number; israeli: number } | null;
  /** The record's rate; null when it is unknown */
  rate: number | null;
}): { foreign: number; israeli: number; matched: boolean; mismatch: number } {
  const { locality, withheld, parts, rate } = params;
  if (!parts || rate == null) {
    return locality === 'LOCAL'
      ? { foreign: 0, israeli: withheld, matched: false, mismatch: 0 }
      : { foreign: withheld, israeli: 0, matched: false, mismatch: 0 };
  }
  const foreign = parts.foreign * rate;
  const israeli = parts.israeli * rate;
  return { foreign, israeli, matched: true, mismatch: foreign + israeli - withheld };
}
