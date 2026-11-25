import {
  addDaysToTimelessDate,
  addYearsToTimelessDate,
  differenceInTimelessDays,
  endOfTimelessYear,
  getTimelessDateYear,
  startOfTimelessYear,
} from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';

function daysInYear(year: number): number {
  return differenceInTimelessDays(startOfTimelessYear(year + 1), startOfTimelessYear(year));
}

/**
 * The last day an asset depreciates: its activation date plus N = 100/rate years, minus one day.
 *
 * - Whole N (5%, 10%, 12.5%, 20%, 25%, 50%, 100%): activation + N calendar years − 1 day. For
 *   example 12.5% from 2023-08-20 ends on 2031-08-19.
 * - Fractional N (6%, 7%, 15%, 33%, 33.33%, 40%): activation + floor(N) calendar years +
 *   round(frac(N) × 365) days − 1 day. For example 33% (N = 3.0303…) from 2023-08-20 ends on
 *   2026-08-30.
 * - A rate of 0 (a category that is not depreciated, such as trademarks), or any rate that is not
 *   a positive number: `null`, there is no end date.
 *
 * Calendar years follow `addYearsToTimelessDate`, so an activation on 29 February lands on
 * 28 February in a common year (and the end date is the day before that).
 *
 * This replaces the SQL expression `activation_date + (100 / percentage * 365) days`, which counted
 * every year as 365 days (and so drifted by the leap days in the asset's life) and divided by zero
 * for a 0% category.
 */
export function depreciationEndDate(
  depreciationRate: number,
  activationDate: TimelessDateString,
): TimelessDateString | null {
  if (!Number.isFinite(depreciationRate) || depreciationRate <= 0) {
    return null;
  }
  const years = 100 / depreciationRate;
  const isWholeYears = Math.abs(years - Math.round(years)) < 1e-9;
  const wholeYears = isWholeYears ? Math.round(years) : Math.floor(years);
  const extraDays = isWholeYears ? 0 : Math.round((years - wholeYears) * 365);
  return addDaysToTimelessDate(addYearsToTimelessDate(activationDate, wholeYears), extraDays - 1);
}

/**
 * Whether an asset is still on the depreciation schedule on or after `fromDate`: its end date
 * (`depreciationEndDate`) is on or after `fromDate`, so a period starting on the end date still
 * takes the final year. An asset with no end date (a 0% category) always qualifies, as its cost
 * stays on the books. Selects the records for a period's depreciation charge and report.
 */
export function depreciatesOnOrAfter(
  depreciationRate: number,
  activationDate: TimelessDateString,
  fromDate: TimelessDateString,
): boolean {
  const endDate = depreciationEndDate(depreciationRate, activationDate);
  return endDate === null || endDate >= fromDate;
}

/**
 * Calculates depreciation amounts for accounting purposes
 * @param depreciationRate - Annual depreciation rate, in percent (e.g. 7 for 7%). A rate of 0 (a
 *  category that is not depreciated) gives no depreciation at all.
 * @param value - Initial value of the asset in ILS
 * @param activationDate - Date when the asset depreciation began
 * @param calculationYear - Year for which to calculate depreciation (as of December 31st)
 * @param endDate - The last day of depreciation; `depreciationEndDate` when missing (callers should
 *  leave it out: it is passed explicitly only to compute the same schedule more than once). In its
 *  year the whole remaining value is depreciated; in later years the accumulated depreciation stays
 *  at that year's closing balance. Disposals and cost refunds are not modelled here: use
 *  `calculateAssetYear` for assets that have them.
 * @returns Object containing yearly depreciation amount and past depreciation amount
 */
export function calculateDepreciation(
  depreciationRate: number,
  value: number,
  activationDate: TimelessDateString,
  calculationYear: number,
  endDate?: TimelessDateString,
): {
  yearlyDepreciationAmount: number;
  yearlyDepreciationRate: number;
  pastDepreciationAmount: number;
} {
  const valueAmount = Math.round(value);
  // Normalize depreciation rate (convert percentage to decimal)
  const normalizedRate = depreciationRate / 100;

  // Create calculation date as December 31st of the calculation year
  const calculationDate = endOfTimelessYear(calculationYear);
  const startOfCalculationYear = startOfTimelessYear(calculationYear);

  // A category that is not depreciated (0%) has no end date and depreciates nothing. If the
  // calculation date is before the activation date, no depreciation applies either.
  const depreciationEnd = endDate ?? depreciationEndDate(depreciationRate, activationDate);
  if (
    !Number.isFinite(depreciationRate) ||
    depreciationRate <= 0 ||
    !depreciationEnd ||
    activationDate > calculationDate
  ) {
    return { yearlyDepreciationAmount: 0, yearlyDepreciationRate: 0, pastDepreciationAmount: 0 };
  }

  // If depreciation ended before the calculation year, no yearly depreciation
  if (depreciationEnd < startOfCalculationYear) {
    // Accumulated depreciation stays at its closing balance of the end year. That call does not
    // come back here (the end date is inside its year), and gives zeros when the end year is
    // before the activation year.
    const atEnd = calculateDepreciation(
      depreciationRate,
      valueAmount,
      activationDate,
      getTimelessDateYear(depreciationEnd),
      depreciationEnd,
    );

    return {
      yearlyDepreciationAmount: 0,
      yearlyDepreciationRate: 0,
      pastDepreciationAmount: atEnd.pastDepreciationAmount + atEnd.yearlyDepreciationAmount,
    };
  }

  // Calculate annual depreciation amount
  const annualDepreciationAmount = Math.round(valueAmount * normalizedRate);

  // Handle different cases for calculation
  const activationYear = getTimelessDateYear(activationDate);
  const effectiveEndDate = depreciationEnd < calculationDate ? depreciationEnd : calculationDate;

  // Calculate past depreciation (up to the start of calculation year)
  let pastDepreciationAmount = 0;

  if (activationYear < calculationYear) {
    // Use recursion to calculate past depreciation for previous years
    const prevYearDepreciation = calculateDepreciation(
      depreciationRate,
      valueAmount,
      activationDate,
      calculationYear - 1,
      depreciationEnd,
    );
    pastDepreciationAmount +=
      prevYearDepreciation.yearlyDepreciationAmount + prevYearDepreciation.pastDepreciationAmount;
  }

  // Cap past depreciation at asset value
  pastDepreciationAmount = Math.min(pastDepreciationAmount, valueAmount);

  // Calculate depreciation for the calculation year
  let yearlyDepreciationAmount: number;

  if (activationYear === calculationYear) {
    // Asset activated during calculation year
    const daysActive = differenceInTimelessDays(effectiveEndDate, activationDate) + 1;
    yearlyDepreciationAmount = Math.round(
      annualDepreciationAmount * (daysActive / daysInYear(calculationYear)),
    );
  } else if (getTimelessDateYear(depreciationEnd) === calculationYear) {
    // Use remaining value for the year if depreciation ends this year
    yearlyDepreciationAmount = Math.max(0, valueAmount - pastDepreciationAmount);
  } else {
    // Asset active for the full calculation year
    yearlyDepreciationAmount = annualDepreciationAmount;
  }

  // Ensure we don't depreciate more than the remaining value
  const remainingValue = Math.max(0, valueAmount - pastDepreciationAmount);
  yearlyDepreciationAmount = Math.min(yearlyDepreciationAmount, remainingValue);

  return {
    yearlyDepreciationAmount,
    yearlyDepreciationRate:
      annualDepreciationAmount > 0
        ? depreciationRate * (yearlyDepreciationAmount / annualDepreciationAmount)
        : 0,
    pastDepreciationAmount,
  };
}

/* ------------------------------------------------------------------------------------------------
 * Events: sale, write-off, cost refund
 * --------------------------------------------------------------------------------------------- */

export type DepreciationDisposalKind = 'SALE' | 'COST_REFUND' | 'WRITE_OFF';

/**
 * How a cost refund corrects the asset:
 * - `FROM_ACTIVATION` (the default): the refund corrects the original price, so the cost is reduced
 *   from activation. Years before the refund year stay as filed; the refund year reverses the
 *   depreciation booked on the refunded part (the recapture) and depreciates the corrected cost.
 * - `FROM_REFUND_DATE`: a later rebate. The cost drops on the refund date and the accumulated
 *   depreciation stays, so the book value drops by the refund; only a refund above the book value
 *   gives income (the excess).
 */
export type CostRefundMode = 'FROM_ACTIVATION' | 'FROM_REFUND_DATE';

export const DEFAULT_COST_REFUND_MODE: CostRefundMode = 'FROM_ACTIVATION';

export type AssetDepreciationInput = {
  /** Asset cost in local currency */
  cost: number;
  /**
   * Statutory annual rate, in percent (e.g. 25 for 25%). 0 is a category that is not depreciated:
   * its cost is tracked and its events apply, but it never depreciates.
   */
  depreciationRate: number;
  activationDate: TimelessDateString;
};

/** An event that changes an asset's cost: a sale, a write-off or a cost refund */
export type AssetDisposalInput = {
  id: string;
  /**
   * The kind of event. A missing kind behaves as a sale (a disposal with proceeds and a gain or
   * loss), as all events did before kinds were passed to the engine.
   */
  kind?: DepreciationDisposalKind | null;
  /** For a cost refund only; a missing mode is `FROM_ACTIVATION` */
  refundMode?: CostRefundMode | null;
  disposalDate: TimelessDateString;
  /**
   * In local currency, excluding VAT. A sale or write-off: the part of the asset's cost that leaves
   * the books. A cost refund: the refunded amount, by which the cost is reduced.
   */
  disposedCost: number;
  /**
   * The consideration for a sale, in local currency, excluding VAT. 0 for a write-off, and for a
   * cost refund, which has no proceeds (the engine ignores it there).
   */
  proceeds: number;
};

export type AssetDisposalResult = {
  id: string;
  disposalDate: TimelessDateString;
  disposedCost: number;
  /** Depreciation accumulated on the disposed slice up to and including the disposal date */
  accumulatedDepreciation: number;
  /** disposedCost − accumulatedDepreciation */
  netBookValue: number;
  proceeds: number;
  /** proceeds − netBookValue: positive is a gain, negative a loss */
  gainLoss: number;
};

export type AssetCostRefundResult = {
  id: string;
  refundDate: TimelessDateString;
  mode: CostRefundMode;
  /** The cost removed by the refund, in whole shekels */
  costReduction: number;
  /**
   * `FROM_ACTIVATION`: the depreciation booked in earlier years on the refunded part, reversed in
   * the refund year (ordinary income). 0 for `FROM_REFUND_DATE`.
   */
  recapture: number;
  /**
   * `FROM_REFUND_DATE`: the part of the refund above the asset's book value on the refund date
   * (ordinary income). 0 for `FROM_ACTIVATION`.
   */
  excessIncome: number;
};

export type AssetYearResult = {
  /** Cost at the start of the year (0 when the asset was activated during the year) */
  openingCost: number;
  /** Cost added during the year (the asset's cost in its activation year, before any refund) */
  additions: number;
  /** Cost removed by sales and write-offs during the year */
  disposedCost: number;
  /** Cost removed by cost refunds during the year */
  refundedCost: number;
  /** openingCost + additions − disposedCost − refundedCost */
  closingCost: number;
  openingAccumulatedDepreciation: number;
  /** Depreciation expense for the year, including the disposed slices up to their disposal dates */
  yearDepreciation: number;
  /**
   * Effective rate claimed for the year, relative to the cost depreciated from the year's start
   * (after the year's cost refunds from activation)
   */
  yearlyDepreciationRate: number;
  /** Accumulated depreciation removed with the disposed slices of sales and write-offs */
  disposedAccumulatedDepreciation: number;
  /**
   * Accumulated depreciation reversed by cost refunds (Σ recapture + excess income): ordinary
   * income, not a gain or loss
   */
  depreciationCorrection: number;
  /**
   * openingAccumulatedDepreciation + yearDepreciation − disposedAccumulatedDepreciation −
   * depreciationCorrection
   */
  closingAccumulatedDepreciation: number;
  /** closingCost − closingAccumulatedDepreciation */
  netBookValue: number;
  /** The year's sales and write-offs */
  disposals: AssetDisposalResult[];
  /** The year's cost refunds */
  costRefunds: AssetCostRefundResult[];
};

function isCostRefund(event: AssetDisposalInput): boolean {
  return event.kind === 'COST_REFUND';
}

function refundModeOf(event: AssetDisposalInput): CostRefundMode {
  return event.refundMode ?? DEFAULT_COST_REFUND_MODE;
}

function isRefundFromActivation(event: AssetDisposalInput): boolean {
  return isCostRefund(event) && refundModeOf(event) === 'FROM_ACTIVATION';
}

/** Whether a disposed cost (or refunded amount) is a usable amount (validation rejects the others) */
function isPositiveAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}

/** round(Σ raw disposed cost) in whole shekels, summed in agorot */
function roundedDisposedTotal(rawCosts: readonly number[]): number {
  const agorot = rawCosts
    .filter(isPositiveAmount)
    .reduce((sum, raw) => sum + Math.round(raw * 100), 0);
  return Math.round(agorot / 100);
}

/**
 * Splits disposed costs and refunded amounts, in date order, into whole-shekel slices that add up
 * to the rounded total, as the asset's cost is rounded (DB numerics carry agorot): each slice is
 * round(Σ raw up to and including it) − round(Σ raw before it). Summing in agorot keeps float
 * drift off the .5 edge. A slice depends only on the events before it, so adding or editing a later
 * event never moves an earlier one. An amount that is not positive takes a 0 slice and does not
 * move the total.
 */
function wholeShekelSlices(rawCosts: readonly number[]): number[] {
  let totalAgorot = 0;
  let previousTotal = 0;
  return rawCosts.map(raw => {
    if (!isPositiveAmount(raw)) {
      return 0;
    }
    totalAgorot += Math.round(raw * 100);
    const total = Math.round(totalAgorot / 100);
    const slice = total - previousTotal;
    previousTotal = total;
    return slice;
  });
}

function sortDisposals(disposals: readonly AssetDisposalInput[]): AssetDisposalInput[] {
  return [...disposals].sort((a, b) =>
    a.disposalDate === b.disposalDate
      ? a.id.localeCompare(b.id)
      : a.disposalDate.localeCompare(b.disposalDate),
  );
}

/**
 * The events by date (then id), with disposed cost (or refunded amount) in whole shekels, rounded
 * cumulatively across all kinds (see `wholeShekelSlices`). Proceeds are kept as given: they only
 * feed the gain or loss, and the ledger moves them out of the charge's proceeds in full.
 */
function normalizeDisposals(disposals: readonly AssetDisposalInput[]): AssetDisposalInput[] {
  const sorted = sortDisposals(disposals);
  const slices = wholeShekelSlices(sorted.map(disposal => disposal.disposedCost));
  return sorted.map((disposal, index) => ({ ...disposal, disposedCost: slices[index] }));
}

function emptyYear(): AssetYearResult {
  return {
    openingCost: 0,
    additions: 0,
    disposedCost: 0,
    refundedCost: 0,
    closingCost: 0,
    openingAccumulatedDepreciation: 0,
    yearDepreciation: 0,
    yearlyDepreciationRate: 0,
    disposedAccumulatedDepreciation: 0,
    depreciationCorrection: 0,
    closingAccumulatedDepreciation: 0,
    netBookValue: 0,
    disposals: [],
    costRefunds: [],
  };
}

/**
 * One year of an asset, with its sales, write-offs and cost refunds.
 *
 * An asset that has no event up to `year` gives exactly what `calculateDepreciation` gives, so
 * years that were already filed (and ledgers that are locked) do not move. From the year of the
 * first event the asset is rolled forward:
 * - cost refunds `FROM_ACTIVATION` dated in a year are applied at the start of that year: the cost
 *   drops by the refund, and the recapture is the accumulated depreciation as booked through the
 *   previous year minus the accumulated depreciation recomputed from activation on the corrected
 *   cost through the previous year (`calculateDepreciation`, with the same per-year rounding and the
 *   same end date). The year and later years then depreciate the corrected cost (nothing is
 *   depreciated on the refunded part in the refund year), and a full refund closes the asset and
 *   recaptures all of its depreciation. When an earlier sale, write-off or refund from the refund
 *   date already changed the base, the recomputation does not apply and the recapture falls back
 *   to the refund's proportional share, round(accumulated × refund / cost);
 * - sales, write-offs and cost refunds `FROM_REFUND_DATE` split the year into segments at their
 *   dates; a segment depreciates round(annual(cost) × days / daysInYear), capped at the remaining
 *   value. The event day belongs to the segment before the event (as the activation day belongs to
 *   the first segment);
 * - at a sale or write-off, the slice takes round(accumulated × disposedCost / cost) of the
 *   accumulated depreciation; its gain or loss is proceeds − (disposedCost − that share);
 * - at a cost refund from the refund date, the cost drops by the refund and the accumulated
 *   depreciation stays, so the book value drops by the refund; a refund above the book value caps
 *   the accumulated depreciation at the new cost, and the excess is income;
 * - what remains keeps depreciating at the same rate on the reduced cost, and the year of the end
 *   date (`depreciationEndDate`) takes the whole remaining value, as `calculateDepreciation` does:
 *   the segment that reaches the end date takes it (before any event on or after the end date, so
 *   such a sale leaves with its slice fully depreciated), and later segments depreciate nothing.
 *
 * A 0% asset (no end date) never depreciates: its cost is tracked, its events apply, a refund has no
 * recapture and a sale's gain or loss is against the full cost.
 *
 * Cost amounts are whole shekels: the asset's cost is rounded, and the events' disposed costs and
 * refunded amounts are rounded cumulatively in date order (each slice is round(Σ up to it) −
 * round(Σ before it)), so the slices add up to the rounded total and a full disposal lands on the
 * rounded cost. The results report those slices. Proceeds are used as given, so their agorot carry
 * into the gain or loss.
 */
export function calculateAssetYear(
  asset: AssetDepreciationInput,
  disposals: readonly AssetDisposalInput[],
  year: number,
): AssetYearResult {
  const cost = Math.round(asset.cost);
  const { depreciationRate, activationDate } = asset;
  const endDate = depreciationEndDate(depreciationRate, activationDate);
  const activationYear = getTimelessDateYear(activationDate);

  if (activationYear > year) {
    return emptyYear();
  }

  const sorted = normalizeDisposals(disposals).filter(
    disposal => getTimelessDateYear(disposal.disposalDate) <= year,
  );

  if (sorted.length === 0) {
    const { yearlyDepreciationAmount, yearlyDepreciationRate, pastDepreciationAmount } =
      calculateDepreciation(depreciationRate, cost, activationDate, year, endDate ?? undefined);
    const closingAccumulatedDepreciation = pastDepreciationAmount + yearlyDepreciationAmount;
    return {
      ...emptyYear(),
      openingCost: activationYear === year ? 0 : cost,
      additions: activationYear === year ? cost : 0,
      closingCost: cost,
      openingAccumulatedDepreciation: pastDepreciationAmount,
      yearDepreciation: yearlyDepreciationAmount,
      yearlyDepreciationRate,
      closingAccumulatedDepreciation,
      netBookValue: cost - closingAccumulatedDepreciation,
    };
  }

  const firstEventYear = getTimelessDateYear(sorted[0].disposalDate);
  const startYear = Math.max(firstEventYear, activationYear);

  // Opening state of the first rolled year: the whole asset, as already reported
  const state: AssetState = {
    cost,
    accumulated:
      activationYear < startYear
        ? calculateDepreciation(
            depreciationRate,
            cost,
            activationDate,
            startYear,
            endDate ?? undefined,
          ).pastDepreciationAmount
        : 0,
    onSchedule: true,
  };

  let result = emptyYear();
  for (let y = startYear; y <= year; y++) {
    result = rollAssetYear(
      state,
      y,
      sorted.filter(disposal => getTimelessDateYear(disposal.disposalDate) === y),
      { depreciationRate, activationDate, activationYear, endDate },
    );
  }
  return result;
}

type AssetState = {
  cost: number;
  accumulated: number;
  /**
   * Whether the accumulated depreciation is still what `calculateDepreciation` gives on the current
   * cost: true until a sale, a write-off or a refund from the refund date changes the base (cost
   * refunds from activation keep it true, as they recompute the schedule on the corrected cost)
   */
  onSchedule: boolean;
};

function rollAssetYear(
  state: AssetState,
  year: number,
  events: AssetDisposalInput[],
  asset: {
    depreciationRate: number;
    activationDate: TimelessDateString;
    activationYear: number;
    endDate: TimelessDateString | null;
  },
): AssetYearResult {
  const { depreciationRate, activationDate, activationYear, endDate } = asset;
  const yearStart = startOfTimelessYear(year);
  const yearEnd = endOfTimelessYear(year);
  const yearDays = daysInYear(year);
  const isFinalYear =
    endDate !== null && getTimelessDateYear(endDate) === year && activationYear !== year;

  const costAtStart = state.cost;
  const openingAccumulatedDepreciation = state.accumulated;

  let yearDepreciation = 0;
  let disposedCost = 0;
  let disposedAccumulatedDepreciation = 0;
  let refundedCost = 0;
  let depreciationCorrection = 0;
  const disposalResults: AssetDisposalResult[] = [];
  const costRefundResults: AssetCostRefundResult[] = [];

  // Cost refunds from activation correct the cost from the start of their year
  for (const refund of events.filter(isRefundFromActivation)) {
    const costReduction = Math.min(refund.disposedCost, state.cost);
    const correctedCost = state.cost - costReduction;
    let recapture: number;
    if (state.onSchedule) {
      // Booked through the previous year, minus the same years recomputed on the corrected cost
      const recomputed = calculateDepreciation(
        depreciationRate,
        correctedCost,
        activationDate,
        year,
        endDate ?? undefined,
      ).pastDepreciationAmount;
      recapture = state.accumulated - recomputed;
    } else {
      recapture = state.cost > 0 ? Math.round((state.accumulated * costReduction) / state.cost) : 0;
    }

    costRefundResults.push({
      id: refund.id,
      refundDate: refund.disposalDate,
      mode: 'FROM_ACTIVATION',
      costReduction,
      recapture,
      excessIncome: 0,
    });

    state.cost = correctedCost;
    state.accumulated -= recapture;
    refundedCost += costReduction;
    depreciationCorrection += recapture;
  }

  const annualAtStart = Math.round((state.cost * depreciationRate) / 100);

  const depreciateSegment = (from: TimelessDateString, to: TimelessDateString, last: boolean) => {
    if (endDate === null || to < from || state.cost <= 0) {
      return;
    }
    const remaining = Math.max(0, state.cost - state.accumulated);
    if (remaining === 0) {
      return;
    }
    let amount: number;
    if (from > endDate) {
      // Segments after the end date depreciate nothing
      amount = 0;
    } else if (isFinalYear && (last || to >= endDate)) {
      // The segment that reaches the end date takes the whole remaining value, also when an event
      // falls on the end date or after it
      amount = remaining;
    } else {
      const segmentEnd = to > endDate ? endDate : to;
      const days = differenceInTimelessDays(segmentEnd, from) + 1;
      const annual = Math.round((state.cost * depreciationRate) / 100);
      amount = Math.round(annual * (days / yearDays));
    }
    amount = Math.min(amount, remaining);
    state.accumulated += amount;
    yearDepreciation += amount;
  };

  let segmentStart = activationYear === year ? activationDate : yearStart;
  for (const event of events.filter(event => !isRefundFromActivation(event))) {
    depreciateSegment(segmentStart, event.disposalDate, false);

    if (isCostRefund(event)) {
      // A refund from the refund date: the cost drops, the accumulated depreciation stays (capped
      // at the new cost; what it is capped by is income)
      const costReduction = Math.min(event.disposedCost, state.cost);
      state.cost -= costReduction;
      const excessIncome = Math.max(0, state.accumulated - state.cost);
      state.accumulated -= excessIncome;

      costRefundResults.push({
        id: event.id,
        refundDate: event.disposalDate,
        mode: 'FROM_REFUND_DATE',
        costReduction,
        recapture: 0,
        excessIncome,
      });
      refundedCost += costReduction;
      depreciationCorrection += excessIncome;
    } else {
      const sliceCost = Math.min(event.disposedCost, state.cost);
      const accumulatedDepreciation =
        state.cost > 0 ? Math.round((state.accumulated * sliceCost) / state.cost) : 0;
      const netBookValue = sliceCost - accumulatedDepreciation;

      disposalResults.push({
        id: event.id,
        disposalDate: event.disposalDate,
        disposedCost: sliceCost,
        accumulatedDepreciation,
        netBookValue,
        proceeds: event.proceeds,
        gainLoss: event.proceeds - netBookValue,
      });

      state.cost -= sliceCost;
      state.accumulated -= accumulatedDepreciation;
      disposedCost += sliceCost;
      disposedAccumulatedDepreciation += accumulatedDepreciation;
    }
    state.onSchedule = false;

    const next = addDaysToTimelessDate(event.disposalDate, 1);
    segmentStart = next > segmentStart ? next : segmentStart;
  }
  depreciateSegment(segmentStart, yearEnd, true);

  const closingAccumulatedDepreciation = state.accumulated;
  return {
    openingCost: activationYear === year ? 0 : costAtStart,
    additions: activationYear === year ? costAtStart : 0,
    disposedCost,
    refundedCost,
    closingCost: state.cost,
    openingAccumulatedDepreciation,
    yearDepreciation,
    yearlyDepreciationRate:
      annualAtStart > 0 ? depreciationRate * (yearDepreciation / annualAtStart) : 0,
    disposedAccumulatedDepreciation,
    depreciationCorrection,
    closingAccumulatedDepreciation,
    netBookValue: state.cost - closingAccumulatedDepreciation,
    disposals: disposalResults,
    costRefunds: costRefundResults,
  };
}

/**
 * The computed result of one sale or write-off of an asset, given all of the asset's events; `null`
 * for a cost refund (see `computeCostRefund`) or an unknown id.
 */
export function computeDisposal(
  asset: AssetDepreciationInput,
  disposals: readonly AssetDisposalInput[],
  disposalId: string,
): AssetDisposalResult | null {
  const disposal = disposals.find(d => d.id === disposalId);
  if (!disposal) {
    return null;
  }
  const { disposals: results } = calculateAssetYear(
    asset,
    disposals,
    getTimelessDateYear(disposal.disposalDate),
  );
  return results.find(result => result.id === disposalId) ?? null;
}

/**
 * The computed result of one cost refund of an asset, given all of the asset's events; `null` for a
 * sale or write-off (see `computeDisposal`) or an unknown id.
 */
export function computeCostRefund(
  asset: AssetDepreciationInput,
  disposals: readonly AssetDisposalInput[],
  refundId: string,
): AssetCostRefundResult | null {
  const refund = disposals.find(d => d.id === refundId);
  if (!refund) {
    return null;
  }
  const { costRefunds } = calculateAssetYear(
    asset,
    disposals,
    getTimelessDateYear(refund.disposalDate),
  );
  return costRefunds.find(result => result.id === refundId) ?? null;
}

/**
 * Cost still on the books after all the given events (refunds included), in whole shekels:
 * round(cost) − round(Σ disposed cost and refunded amounts), as the cumulatively rounded slices add
 * up to.
 */
export function remainingAssetCost(
  asset: Pick<AssetDepreciationInput, 'cost'>,
  disposals: readonly Pick<AssetDisposalInput, 'disposedCost'>[],
): number {
  const disposed = roundedDisposedTotal(disposals.map(disposal => disposal.disposedCost));
  return Math.max(0, Math.round(asset.cost) - disposed);
}

/**
 * Validates an asset's full set of events (existing ones plus a new or edited one): dates on or
 * after activation; disposed costs and refunded amounts positive as given, with whole-shekel slices
 * (rounded cumulatively, as `calculateAssetYear` uses them) of at least 1; and sales, write-offs
 * and refunds that together remove no more than the rounded cost (round(Σ amounts) against
 * round(cost)), each refund's slice no more than the cost still on the books on its date. Proceeds
 * are checked as given. The rules of each kind are checked by `validateDisposalKind`. Returns error
 * messages; an empty array means valid.
 */
export function validateAssetDisposals(
  asset: Pick<AssetDepreciationInput, 'cost' | 'activationDate'>,
  disposals: readonly AssetDisposalInput[],
): string[] {
  const errors: string[] = [];
  const cost = Math.round(asset.cost);
  if (!Number.isFinite(cost) || cost <= 0) {
    errors.push('The asset must have a positive cost before it can be disposed of');
    return errors;
  }

  // The checks on the amount as given come first, and an invalid amount takes no slice, so one
  // bad event does not shift the slices of the later ones
  const sorted = sortDisposals(disposals);
  const slices = wholeShekelSlices(sorted.map(disposal => disposal.disposedCost));
  let removed = 0;
  let refundExceedsCost = false;
  for (const [index, event] of sorted.entries()) {
    const slice = slices[index];
    const refund = isCostRefund(event);
    if (event.disposalDate < asset.activationDate) {
      errors.push(
        `${refund ? 'Refund' : 'Disposal'} date ${event.disposalDate} is before the asset's activation date ${asset.activationDate}`,
      );
    }
    if (!isPositiveAmount(event.disposedCost)) {
      errors.push(
        refund ? 'The refunded amount must be positive' : 'Disposed cost must be positive',
      );
    } else if (slice <= 0) {
      errors.push(
        refund
          ? 'The refunded amount must be at least 1 (amounts are rounded to whole shekels)'
          : 'Disposed cost must be at least 1 (amounts are rounded to whole shekels)',
      );
    }
    if (Number.isNaN(event.proceeds) || event.proceeds < 0) {
      errors.push('Proceeds cannot be negative');
    }
    if (removed >= cost) {
      errors.push(`The asset was fully disposed of before ${event.disposalDate}`);
    } else if (refund && slice > cost - removed) {
      refundExceedsCost = true;
      errors.push(
        `The refunded amount (${slice}) exceeds the cost still on the books on ${event.disposalDate} (${cost - removed}), both rounded to whole shekels`,
      );
    }
    removed += slice;
  }
  // The slices add up to round(Σ amounts)
  if (removed > cost && !refundExceedsCost) {
    errors.push(
      `Disposed cost (${removed}) exceeds the asset's cost (${cost}), both rounded to whole shekels`,
    );
  }
  return errors;
}

/** Validates the kind-specific rules of a single event. Returns error messages. */
export function validateDisposalKind(input: {
  type: DepreciationDisposalKind;
  /** Not used by the kind rules; kept so that existing callers keep compiling */
  disposedCost?: number;
  proceeds: number;
  refundMode?: CostRefundMode | null;
  chargeId?: string | null;
}): string[] {
  const errors: string[] = [];
  if (input.refundMode != null && input.type !== 'COST_REFUND') {
    errors.push('A refund mode applies only to a cost refund');
  }
  switch (input.type) {
    case 'COST_REFUND':
      if (input.proceeds !== 0) {
        errors.push('A cost refund has no proceeds: the refunded amount reduces the cost');
      }
      if (
        input.refundMode != null &&
        input.refundMode !== 'FROM_ACTIVATION' &&
        input.refundMode !== 'FROM_REFUND_DATE'
      ) {
        errors.push(`Unknown refund mode ${String(input.refundMode)}`);
      }
      if (!input.chargeId) {
        errors.push('A cost refund must be linked to the charge that carries the refund');
      }
      break;
    case 'SALE':
      if (!input.chargeId) {
        errors.push('A sale must be linked to the charge that carries the sale');
      }
      break;
    case 'WRITE_OFF':
      if (input.proceeds !== 0) {
        errors.push('A write-off has no proceeds');
      }
      break;
  }
  return errors;
}
