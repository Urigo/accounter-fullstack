import { timelessDateFromParts } from '../../../shared/helpers/timeless-date.js';
import type { TimelessDateString } from '../../../shared/types/index.js';

/*
 * The arithmetic of a company's semi-annual securities report (Income Tax Ordinance s.91(d)(2c)):
 * pure, so every rule is tested on its own. The data is gathered by
 * `securities-semi-annual-report-data.helper.ts`.
 *
 * What is reported, after the Tax Authority's guidance (July 2006) and the accountant's letter:
 * the half's sales turnover, its real capital gains and losses, its dividend and interest income,
 * its securities expenses, the tax on them and the advance due. A company pays the regular
 * corporate tax rate on all of it (s.91(a), s.126(a)), except for local dividends, which are exempt
 * (s.126(b)).
 */

export type YearHalf = 'H1' | 'H2';
export type SecuritiesIncomeKind = 'DIVIDEND' | 'INTEREST';
export type SecuritiesIncomeLocality = 'LOCAL' | 'FOREIGN';
export type SemiAnnualAdvanceNote =
  | 'CAPITAL_GAINS_OFFSET_BY_CARRIED_FORWARD_LOSSES'
  | 'CAPITAL_LOSS_IN_PERIOD'
  | 'CAPITAL_LOSS_OFFSET_AGAINST_INCOME'
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
  /** The year's capital loss set against it (s.92(a)(4)) */
  capitalLossOffset: number;
  /** The securities expenses deducted from it */
  expensesDeducted: number;
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
  /** The year's capital loss set against the half's dividends and interest (s.92(a)(4)) */
  capitalLossOffsetAgainstIncome: number;
  /** The half's securities expenses (fees, financial consultancy) */
  securitiesExpenses: number;
  /** The part of the expenses deducted from the capital gain */
  expensesDeductedFromGains: number;
  /** The part of the expenses deducted from the dividends and interest */
  expensesDeductedFromIncome: number;
  /** Expenses beyond the half's taxable income, left for the annual return */
  unusedExpenses: number;
  /** The capital gain the tax is on: after carried-forward losses and expenses */
  taxableCapitalGain: number;
  /** The tax lines are null when there is no tax rate */
  capitalGainsTax: number | null;
  dividendsTax: number | null;
  interestTax: number | null;
  grossTax: number | null;
  foreignTaxCredit: number | null;
  taxLiability: number | null;
  /** Israeli tax withheld on taxable dividends and interest: credited against the liability */
  israeliTaxWithheldOnIncome: number;
  /**
   * Israeli tax withheld on exempt income (local dividends, s.126(b)): no advance is due on that
   * income, so it is not credited here but refunded in the annual return
   */
  israeliTaxWithheldOnExemptIncome: number;
  /** (e) The advance to pay, never below zero */
  taxAdvance: number | null;
  /** Israeli tax withheld beyond the liability */
  excessCredits: number | null;
  advanceNotes: SemiAnnualAdvanceNote[];
};

/** A half's income by bucket, in whole shekels */
function summarizeIncome(income: readonly SemiAnnualIncomeFigures[]) {
  return SEMI_ANNUAL_INCOME_BUCKETS.map(({ kind, locality }) => {
    const records = income.filter(record => record.kind === kind && record.locality === locality);
    return {
      kind,
      locality,
      gross: shekels(sum(records.map(record => record.gross))),
      foreignTaxWithheld: shekels(sum(records.map(record => record.foreignTaxWithheld))),
      israeliTaxWithheld: shekels(sum(records.map(record => record.israeliTaxWithheld))),
      taxable: isTaxableIncome(kind, locality),
    };
  });
}

type IncomeBucketTotals = ReturnType<typeof summarizeIncome>[number];

/**
 * Spreads a deduction over the taxable income, up to what is left of each bucket (`room`, which it
 * reduces). The buckets with the least foreign tax per shekel come first: a deduction from them
 * wastes the least foreign tax credit.
 */
function spreadOverIncome(
  buckets: readonly IncomeBucketTotals[],
  room: number[],
  amount: number,
): { taken: number[]; left: number } {
  const foreignTaxShare = (bucket: IncomeBucketTotals) =>
    bucket.gross > 0 ? Math.max(0, bucket.foreignTaxWithheld) / bucket.gross : 0;
  const order = buckets
    .map((bucket, index) => ({ index, share: foreignTaxShare(bucket) }))
    .sort((a, b) => a.share - b.share || a.index - b.index);
  const taken = buckets.map(() => 0);
  let left = Math.max(0, amount);
  for (const { index } of order) {
    const take = Math.min(left, room[index]!);
    taken[index] = take;
    room[index]! -= take;
    left -= take;
  }
  return { taken, left };
}

/**
 * What offsets a half's capital gain and income, in the order the law and the taxpayer's interest
 * set:
 * 1. The year's capital losses — the half's own net loss, and in the second half what the first
 *    half left unused — offset its capital gains first, then the prior years' losses (s.92(b)),
 *    which can offset capital gains only.
 * 2. What is left of the year's capital loss offsets the securities dividends and interest
 *    (s.92(a)(4)).
 * 3. The securities expenses come off the capital gain left, then off the income left. What they
 *    exceed is left for the annual return.
 */
function settleHalf(params: {
  netRealCapitalGain: number;
  buckets: readonly IncomeBucketTotals[];
  expenses: number;
  priorYearsLosses: number;
  /** The year's capital loss the half starts with: the first half's unused loss, in the second */
  yearLoss: number;
}) {
  let gain = Math.max(0, params.netRealCapitalGain);
  let yearLoss = params.yearLoss + Math.max(0, -params.netRealCapitalGain);
  const yearLossOnGains = Math.min(yearLoss, gain);
  gain -= yearLossOnGains;
  yearLoss -= yearLossOnGains;
  const priorLossesOnGains = Math.min(params.priorYearsLosses, gain);
  gain -= priorLossesOnGains;

  const room = params.buckets.map(bucket => (bucket.taxable ? Math.max(0, bucket.gross) : 0));
  const lossOffset = spreadOverIncome(params.buckets, room, yearLoss);

  const expenses = Math.max(0, params.expenses);
  const expensesOnGains = Math.min(expenses, gain);
  gain -= expensesOnGains;
  const expensesOnIncome = spreadOverIncome(params.buckets, room, expenses - expensesOnGains);

  return {
    lossesOnGains: yearLossOnGains + priorLossesOnGains,
    lossOffset: lossOffset.taken,
    expensesOnGains,
    expensesOnIncome: expensesOnIncome.taken,
    unusedExpenses: expensesOnIncome.left,
    taxableCapitalGain: gain,
    remaining: {
      priorYearsLosses: params.priorYearsLosses - priorLossesOnGains,
      yearLoss: lossOffset.left,
    },
  };
}

export type SemiAnnualDeclarationParams = {
  /** The corporate tax rate, as a fraction; null when none is set */
  taxRate: number | null;
  priorYearsLosses: number;
  sales: readonly SemiAnnualSaleFigures[];
  income: readonly SemiAnnualIncomeFigures[];
  /** The half's securities expenses, in ILS */
  expenses: number;
} & (
  | { half: 'H1' }
  | {
      half: 'H2';
      /** The first half's sales and income, which the second half carries losses from */
      firstHalf: {
        sales: readonly SemiAnnualSaleFigures[];
        income: readonly SemiAnnualIncomeFigures[];
      };
    }
);

/**
 * The declaration of a half.
 *
 * - Capital gains: the half's real gains less its losses, less the capital losses carried forward
 *   (s.92(b)). In the second half, those are the prior years' losses still unused after the first
 *   half, plus what the first half's own net loss did not offset there.
 * - A net capital loss of the year offsets the securities dividends and interest (s.92(a)(4)).
 * - The securities expenses are deducted from the capital gain, then from the income (see
 *   `settleHalf`).
 * - Dividends and interest are taxed by bucket (kind × locality) at the same rate, local dividends
 *   excepted; the foreign tax withheld on a bucket is credited against its tax, capped at it — so
 *   excess foreign tax on one bucket does not reduce the tax on another.
 * - The liability is the gross tax less the foreign tax credit; the advance is the liability less
 *   the Israeli tax withheld at source (s.91(d)(6)), never below zero.
 *
 * Not modelled: carrying an unused foreign tax credit or unused expenses between halves.
 */
export function computeSemiAnnualDeclaration(
  params: SemiAnnualDeclarationParams,
): SemiAnnualDeclaration {
  const { taxRate } = params;
  const salesSummary = summarizeSemiAnnualSales(params.sales);
  const priorYearsLosses = shekels(Math.max(0, params.priorYearsLosses));
  const securitiesExpenses = shekels(params.expenses);

  let firstHalfNetRealCapitalGain: number | null = null;
  let carried = { priorYearsLosses, yearLoss: 0 };
  if (params.half === 'H2') {
    firstHalfNetRealCapitalGain = summarizeSemiAnnualSales(
      params.firstHalf.sales,
    ).netRealCapitalGain;
    // the first half's expenses take nothing from the losses, so they are not needed here
    carried = settleHalf({
      netRealCapitalGain: firstHalfNetRealCapitalGain,
      buckets: summarizeIncome(params.firstHalf.income),
      expenses: 0,
      priorYearsLosses,
      yearLoss: 0,
    }).remaining;
  }
  const lossesCarriedForward = carried.priorYearsLosses + carried.yearLoss;
  const netRealCapitalGainAfterLosses = salesSummary.netRealCapitalGain - lossesCarriedForward;

  const buckets = summarizeIncome(params.income);
  const settled = settleHalf({
    netRealCapitalGain: salesSummary.netRealCapitalGain,
    buckets,
    expenses: securitiesExpenses,
    ...carried,
  });

  const taxOn = (amount: number) =>
    taxRate == null ? null : shekels(taxRate * Math.max(0, amount));

  const incomeSummary = buckets.map((bucket, index) => {
    const capitalLossOffset = settled.lossOffset[index]!;
    const expensesDeducted = settled.expensesOnIncome[index]!;
    const tax = bucket.taxable
      ? taxOn(bucket.gross - capitalLossOffset - expensesDeducted)
      : taxRate == null
        ? null
        : 0;
    return {
      ...bucket,
      capitalLossOffset,
      expensesDeducted,
      tax,
      foreignTaxCredit: tax == null ? null : Math.min(Math.max(0, bucket.foreignTaxWithheld), tax),
    } satisfies SemiAnnualIncomeSummary;
  });

  const incomeOf = (kind: SecuritiesIncomeKind) =>
    incomeSummary.filter(bucket => bucket.kind === kind);
  const dividendIncome = sum(incomeOf('DIVIDEND').map(bucket => bucket.gross));
  const interestIncome = sum(incomeOf('INTEREST').map(bucket => bucket.gross));
  const withheldOn = (buckets: readonly SemiAnnualIncomeSummary[]) =>
    sum(buckets.map(bucket => bucket.israeliTaxWithheld));
  const israeliTaxWithheldOnIncome = withheldOn(incomeSummary.filter(bucket => bucket.taxable));
  const israeliTaxWithheldOnExemptIncome = withheldOn(
    incomeSummary.filter(bucket => !bucket.taxable),
  );
  const capitalLossOffsetAgainstIncome = sum(settled.lossOffset);

  const capitalGainsTax = taxOn(settled.taxableCapitalGain);
  const declaration = {
    ...salesSummary,
    priorYearsLosses,
    firstHalfNetRealCapitalGain,
    lossesCarriedForward,
    netRealCapitalGainAfterLosses,
    dividendIncome,
    interestIncome,
    incomeSummary,
    capitalLossOffsetAgainstIncome,
    securitiesExpenses,
    expensesDeductedFromGains: settled.expensesOnGains,
    expensesDeductedFromIncome: sum(settled.expensesOnIncome),
    unusedExpenses: settled.unusedExpenses,
    taxableCapitalGain: settled.taxableCapitalGain,
    israeliTaxWithheldOnIncome,
    israeliTaxWithheldOnExemptIncome,
  };

  const hasEvents =
    salesSummary.saleCount > 0 ||
    incomeSummary.some(bucket => bucket.gross !== 0) ||
    securitiesExpenses !== 0;

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
  if (salesSummary.netRealCapitalGain > 0 && settled.lossesOnGains > 0) {
    advanceNotes.push('CAPITAL_GAINS_OFFSET_BY_CARRIED_FORWARD_LOSSES');
  }
  if (salesSummary.saleCount > 0 && salesSummary.netRealCapitalGain < 0) {
    advanceNotes.push('CAPITAL_LOSS_IN_PERIOD');
  }
  if (capitalLossOffsetAgainstIncome > 0) {
    advanceNotes.push('CAPITAL_LOSS_OFFSET_AGAINST_INCOME');
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
 * local-currency record. Null when the entity is not on the record, or when its slot carries a
 * foreign amount of zero against a local one.
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
 * apart, in its settlement currency. The line is apportioned by the execution's shares, so the
 * split needs no rate and always adds up to the line — the sheet matches the books. The record's
 * own rate only checks the line against the execution: `mismatch` is how far the execution's tax,
 * converted at it, is from the line (0 when the rate is unknown).
 *
 * When the execution is unknown, or reports no tax to apportion by, the whole line is taken as the
 * tax its locality makes likelier — Israeli on a local security, foreign on a foreign one — and the
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
  const byLocality =
    locality === 'LOCAL' ? { foreign: 0, israeli: withheld } : { foreign: withheld, israeli: 0 };
  if (!parts) {
    return { ...byLocality, matched: false, mismatch: 0 };
  }
  const total = parts.foreign + parts.israeli;
  const mismatch = rate == null ? 0 : total * rate - withheld;
  if (total === 0) {
    // the execution reports no tax: a line beyond it is a mismatch, with no split to go by
    return { ...byLocality, matched: true, mismatch: -withheld };
  }
  const foreign = (withheld * parts.foreign) / total;
  return { foreign, israeli: withheld - foreign, matched: true, mismatch };
}
