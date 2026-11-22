import {
  addDaysToTimelessDate,
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
 * The date an asset finishes depreciating when no end date is stored: activation plus 100/rate
 * years, the fractional final year counted in days.
 */
export function naturalDepreciationEndDate(
  depreciationRate: number,
  activationDate: TimelessDateString,
): TimelessDateString {
  const normalizedRate = depreciationRate / 100;
  const yearsToFullDepreciation = 1 / normalizedRate;
  const activationYear = getTimelessDateYear(activationDate);
  const fullDepreciationYear = activationYear + Math.ceil(yearsToFullDepreciation);

  const fullYears = Math.floor(yearsToFullDepreciation);
  const fractionalYear = yearsToFullDepreciation - fullYears;

  if (fractionalYear > 0) {
    const daysInFinalYear = daysInYear(fullDepreciationYear);
    const daysToAdd = Math.ceil(fractionalYear * daysInFinalYear);
    return addDaysToTimelessDate(startOfTimelessYear(fullDepreciationYear), daysToAdd - 1);
  }
  return endOfTimelessYear(fullDepreciationYear - 1);
}

/**
 * Calculates depreciation amounts for accounting purposes
 * @param depreciationRate - Annual depreciation rate (e.g., 0.07 for 7%)
 * @param value - Initial value of the asset in ILS
 * @param activationDate - Date when the asset depreciation began
 * @param calculationYear - Year for which to calculate depreciation (as of December 31st)
 * @param depreciationEndDate - Optional natural end of depreciation (the asset's expiration date).
 *  In its year the whole remaining value is depreciated. Disposals are not modelled here: use
 *  `calculateAssetYear` for assets that were sold, refunded or written off.
 * @returns Object containing yearly depreciation amount and past depreciation amount
 */
export function calculateDepreciation(
  depreciationRate: number,
  value: number,
  activationDate: TimelessDateString,
  calculationYear: number,
  depreciationEndDate?: TimelessDateString,
): {
  yearlyDepreciationAmount: number;
  yearlyDepreciationRate: number;
  pastDepreciationAmount: number;
} {
  const valueAmount = Math.round(value);
  // Normalize depreciation rate (convert percentage to decimal)
  const normalizedRate = depreciationRate / 100;

  // Calculate end date if not provided
  depreciationEndDate ??= naturalDepreciationEndDate(depreciationRate, activationDate);

  // Create calculation date as December 31st of the calculation year
  const calculationDate = endOfTimelessYear(calculationYear);
  const startOfCalculationYear = startOfTimelessYear(calculationYear);

  // If calculation date is before activation date, no depreciation applies
  if (activationDate > calculationDate) {
    return { yearlyDepreciationAmount: 0, yearlyDepreciationRate: 0, pastDepreciationAmount: 0 };
  }

  // If depreciation ended before the calculation year, no yearly depreciation
  if (depreciationEndDate < startOfCalculationYear) {
    // Calculate total depreciation up to the end date
    const totalYearsActive = differenceInTimelessDays(depreciationEndDate, activationDate) / 365.25;
    const totalDepreciation = Math.min(
      valueAmount,
      Math.round(valueAmount * normalizedRate * totalYearsActive),
    );

    return {
      yearlyDepreciationAmount: 0,
      yearlyDepreciationRate: 0,
      pastDepreciationAmount: totalDepreciation,
    };
  }

  // Calculate annual depreciation amount
  const annualDepreciationAmount = Math.round(valueAmount * normalizedRate);

  // Handle different cases for calculation
  const activationYear = getTimelessDateYear(activationDate);
  const effectiveEndDate =
    depreciationEndDate < calculationDate ? depreciationEndDate : calculationDate;

  // Calculate past depreciation (up to the start of calculation year)
  let pastDepreciationAmount = 0;

  if (activationYear < calculationYear) {
    // Use recursion to calculate past depreciation for previous years
    const prevYearDepreciation = calculateDepreciation(
      depreciationRate,
      valueAmount,
      activationDate,
      calculationYear - 1,
      depreciationEndDate,
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
  } else if (getTimelessDateYear(depreciationEndDate) === calculationYear) {
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
      depreciationRate * (yearlyDepreciationAmount / annualDepreciationAmount),
    pastDepreciationAmount,
  };
}

/* ------------------------------------------------------------------------------------------------
 * Disposals: sale, cost refund, write-off
 * --------------------------------------------------------------------------------------------- */

export type DepreciationDisposalKind = 'SALE' | 'COST_REFUND' | 'WRITE_OFF';

export type AssetDepreciationInput = {
  /** Asset cost in local currency */
  cost: number;
  /** Statutory annual rate, in percent (e.g. 25 for 25%) */
  depreciationRate: number;
  activationDate: TimelessDateString;
  /** Natural end of depreciation; derived from the rate when missing */
  expirationDate?: TimelessDateString | null;
};

export type AssetDisposalInput = {
  id: string;
  disposalDate: TimelessDateString;
  /** The part of the asset's cost that leaves the books, in local currency, excluding VAT */
  disposedCost: number;
  /** The consideration for that part, in local currency, excluding VAT (0 for a write-off) */
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

export type AssetYearResult = {
  /** Cost at the start of the year (0 when the asset was activated during the year) */
  openingCost: number;
  /** Cost added during the year (the asset's cost in its activation year) */
  additions: number;
  /** Cost removed by disposals during the year */
  disposedCost: number;
  /** openingCost + additions − disposedCost */
  closingCost: number;
  openingAccumulatedDepreciation: number;
  /** Depreciation expense for the year, including the disposed slices up to their disposal dates */
  yearDepreciation: number;
  /** Effective rate claimed for the year, relative to the cost depreciated from the year's start */
  yearlyDepreciationRate: number;
  /** Accumulated depreciation removed with the disposed slices */
  disposedAccumulatedDepreciation: number;
  closingAccumulatedDepreciation: number;
  /** closingCost − closingAccumulatedDepreciation */
  netBookValue: number;
  disposals: AssetDisposalResult[];
};

function sortDisposals(disposals: readonly AssetDisposalInput[]): AssetDisposalInput[] {
  return [...disposals].sort((a, b) =>
    a.disposalDate === b.disposalDate
      ? a.id.localeCompare(b.id)
      : a.disposalDate.localeCompare(b.disposalDate),
  );
}

/**
 * One year of an asset, with its disposals.
 *
 * An asset that has no disposal up to `year` gives exactly what `calculateDepreciation` gives, so
 * years that were already filed (and ledgers that are locked) do not move. From the year of the
 * first disposal the asset is rolled forward:
 * - the year is split into segments at each disposal date; a segment depreciates
 *   round(annual(cost) × days / daysInYear), capped at the remaining value. The disposal day belongs
 *   to the segment before the disposal (as the activation day belongs to the first segment);
 * - at a disposal, the slice takes round(accumulated × disposedCost / cost) of the accumulated
 *   depreciation; its gain or loss is proceeds − (disposedCost − that share);
 * - what remains keeps depreciating at the same rate on the reduced cost, and the year of the
 *   natural end date takes the whole remaining value, as `calculateDepreciation` does.
 */
export function calculateAssetYear(
  asset: AssetDepreciationInput,
  disposals: readonly AssetDisposalInput[],
  year: number,
): AssetYearResult {
  const cost = Math.round(asset.cost);
  const { depreciationRate, activationDate } = asset;
  const expirationDate =
    asset.expirationDate ?? naturalDepreciationEndDate(depreciationRate, activationDate);
  const activationYear = getTimelessDateYear(activationDate);

  const zero: AssetYearResult = {
    openingCost: 0,
    additions: 0,
    disposedCost: 0,
    closingCost: 0,
    openingAccumulatedDepreciation: 0,
    yearDepreciation: 0,
    yearlyDepreciationRate: 0,
    disposedAccumulatedDepreciation: 0,
    closingAccumulatedDepreciation: 0,
    netBookValue: 0,
    disposals: [],
  };

  if (activationYear > year) {
    return zero;
  }

  const sorted = sortDisposals(disposals).filter(
    disposal => getTimelessDateYear(disposal.disposalDate) <= year,
  );

  if (sorted.length === 0) {
    const { yearlyDepreciationAmount, yearlyDepreciationRate, pastDepreciationAmount } =
      calculateDepreciation(depreciationRate, cost, activationDate, year, expirationDate);
    const closingAccumulatedDepreciation = pastDepreciationAmount + yearlyDepreciationAmount;
    return {
      ...zero,
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

  const firstDisposalYear = getTimelessDateYear(sorted[0].disposalDate);
  const startYear = Math.max(firstDisposalYear, activationYear);

  // Opening state of the first rolled year: the whole asset, as already reported
  const state = {
    cost,
    accumulated:
      activationYear < startYear
        ? calculateDepreciation(depreciationRate, cost, activationDate, startYear, expirationDate)
            .pastDepreciationAmount
        : 0,
  };

  let result = zero;
  for (let y = startYear; y <= year; y++) {
    result = rollAssetYear(
      state,
      y,
      sorted.filter(disposal => getTimelessDateYear(disposal.disposalDate) === y),
      { depreciationRate, activationDate, activationYear, expirationDate },
    );
  }
  return result;
}

function rollAssetYear(
  state: { cost: number; accumulated: number },
  year: number,
  disposals: AssetDisposalInput[],
  asset: {
    depreciationRate: number;
    activationDate: TimelessDateString;
    activationYear: number;
    expirationDate: TimelessDateString;
  },
): AssetYearResult {
  const { depreciationRate, activationDate, activationYear, expirationDate } = asset;
  const yearStart = startOfTimelessYear(year);
  const yearEnd = endOfTimelessYear(year);
  const yearDays = daysInYear(year);
  const isFinalYear = getTimelessDateYear(expirationDate) === year && activationYear !== year;

  const costAtStart = state.cost;
  const openingAccumulatedDepreciation = state.accumulated;
  const annualAtStart = Math.round((costAtStart * depreciationRate) / 100);

  let yearDepreciation = 0;
  let disposedCost = 0;
  let disposedAccumulatedDepreciation = 0;
  const disposalResults: AssetDisposalResult[] = [];

  const depreciateSegment = (from: TimelessDateString, to: TimelessDateString, last: boolean) => {
    if (to < from || state.cost <= 0) {
      return;
    }
    const remaining = Math.max(0, state.cost - state.accumulated);
    if (remaining === 0) {
      return;
    }
    let amount: number;
    if (from > expirationDate) {
      amount = 0;
    } else if (last && isFinalYear) {
      amount = remaining;
    } else {
      const segmentEnd = to > expirationDate ? expirationDate : to;
      const days = differenceInTimelessDays(segmentEnd, from) + 1;
      const annual = Math.round((state.cost * depreciationRate) / 100);
      amount = Math.round(annual * (days / yearDays));
    }
    amount = Math.min(amount, remaining);
    state.accumulated += amount;
    yearDepreciation += amount;
  };

  let segmentStart = activationYear === year ? activationDate : yearStart;
  for (const disposal of disposals) {
    depreciateSegment(segmentStart, disposal.disposalDate, false);

    const sliceCost = Math.min(disposal.disposedCost, state.cost);
    const accumulatedDepreciation =
      state.cost > 0 ? Math.round((state.accumulated * sliceCost) / state.cost) : 0;
    const netBookValue = sliceCost - accumulatedDepreciation;

    disposalResults.push({
      id: disposal.id,
      disposalDate: disposal.disposalDate,
      disposedCost: sliceCost,
      accumulatedDepreciation,
      netBookValue,
      proceeds: disposal.proceeds,
      gainLoss: disposal.proceeds - netBookValue,
    });

    state.cost -= sliceCost;
    state.accumulated -= accumulatedDepreciation;
    disposedCost += sliceCost;
    disposedAccumulatedDepreciation += accumulatedDepreciation;

    const next = addDaysToTimelessDate(disposal.disposalDate, 1);
    segmentStart = next > segmentStart ? next : segmentStart;
  }
  depreciateSegment(segmentStart, yearEnd, true);

  const closingAccumulatedDepreciation = state.accumulated;
  return {
    openingCost: activationYear === year ? 0 : costAtStart,
    additions: activationYear === year ? costAtStart : 0,
    disposedCost,
    closingCost: state.cost,
    openingAccumulatedDepreciation,
    yearDepreciation,
    yearlyDepreciationRate:
      annualAtStart > 0 ? depreciationRate * (yearDepreciation / annualAtStart) : 0,
    disposedAccumulatedDepreciation,
    closingAccumulatedDepreciation,
    netBookValue: state.cost - closingAccumulatedDepreciation,
    disposals: disposalResults,
  };
}

/** The computed result of one disposal of an asset, given all of the asset's disposals. */
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

/** Cost still on the books after all the given disposals. */
export function remainingAssetCost(
  asset: Pick<AssetDepreciationInput, 'cost'>,
  disposals: readonly Pick<AssetDisposalInput, 'disposedCost'>[],
): number {
  const disposed = disposals.reduce((sum, disposal) => sum + disposal.disposedCost, 0);
  return Math.max(0, Math.round(asset.cost) - disposed);
}

/**
 * Validates an asset's full set of disposals (existing ones plus a new or edited one).
 * Returns error messages; an empty array means valid.
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

  let disposed = 0;
  for (const disposal of sortDisposals(disposals)) {
    if (disposal.disposalDate < asset.activationDate) {
      errors.push(
        `Disposal date ${disposal.disposalDate} is before the asset's activation date ${asset.activationDate}`,
      );
    }
    if (Number.isNaN(disposal.disposedCost) || disposal.disposedCost <= 0) {
      errors.push('Disposed cost must be positive');
    }
    if (Number.isNaN(disposal.proceeds) || disposal.proceeds < 0) {
      errors.push('Proceeds cannot be negative');
    }
    if (disposed >= cost) {
      errors.push(`The asset was fully disposed of before ${disposal.disposalDate}`);
    }
    disposed += disposal.disposedCost;
  }
  if (disposed > cost) {
    errors.push(`Disposed cost (${disposed}) exceeds the asset's cost (${cost})`);
  }
  return errors;
}

/** Validates the type-specific rules of a single disposal. Returns error messages. */
export function validateDisposalKind(input: {
  type: DepreciationDisposalKind;
  disposedCost: number;
  proceeds: number;
  chargeId?: string | null;
}): string[] {
  const errors: string[] = [];
  switch (input.type) {
    case 'COST_REFUND':
      if (input.proceeds !== input.disposedCost) {
        errors.push('A cost refund must have proceeds equal to the refunded cost');
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
