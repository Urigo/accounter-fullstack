import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import {
  addDaysToTimelessDate,
  differenceInTimelessDays,
  endOfTimelessYear,
  getTimelessDateYear,
  startOfTimelessYear,
} from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { DepreciationCategoriesProvider } from '../../depreciation/providers/depreciation-categories.provider.js';
import { DepreciationProvider } from '../../depreciation/providers/depreciation.provider.js';

function daysInYear(year: number): number {
  return differenceInTimelessDays(startOfTimelessYear(year + 1), startOfTimelessYear(year));
}

/**
 * Calculates depreciation amounts for accounting purposes
 * @param depreciationRate - Annual depreciation rate (e.g., 0.07 for 7%)
 * @param value - Initial value of the asset in ILS
 * @param activationDate - Date when the asset depreciation began
 * @param calculationYear - Year for which to calculate depreciation (as of December 31st)
 * @param depreciationEndDate - Optional date when depreciation ends (e.g., asset sold)
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
  if (!depreciationEndDate) {
    const yearsToFullDepreciation = 1 / normalizedRate;
    const activationYear = getTimelessDateYear(activationDate);
    const fullDepreciationYear = activationYear + Math.ceil(yearsToFullDepreciation);

    // Calculate proportional days for the fractional year
    const fullYears = Math.floor(yearsToFullDepreciation);
    const fractionalYear = yearsToFullDepreciation - fullYears;

    if (fractionalYear > 0) {
      const daysInFinalYear = daysInYear(fullDepreciationYear);
      const daysToAdd = Math.ceil(fractionalYear * daysInFinalYear);
      depreciationEndDate = addDaysToTimelessDate(
        startOfTimelessYear(fullDepreciationYear),
        daysToAdd - 1,
      );
    } else {
      depreciationEndDate = endOfTimelessYear(fullDepreciationYear - 1); // Last day of previous year
    }
  }

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

export async function calculateDepreciationAmount(injector: Injector, year: number) {
  const depreciationRecords = await injector
    .get(DepreciationProvider)
    .getDepreciationRecordsByDates({
      fromDate: startOfTimelessYear(year),
      toDate: endOfTimelessYear(year),
    });

  let rndDepreciationYearlyAmount = 0;
  let gnmDepreciationYearlyAmount = 0;
  let marketingDepreciationYearlyAmount = 0;

  await Promise.all(
    depreciationRecords.map(async record => {
      const depreciationCategory = await injector
        .get(DepreciationCategoriesProvider)
        .getDepreciationCategoriesByIdLoader.load(record.category);
      if (!depreciationCategory) {
        console.error('No depreciation category for depreciation record', record);
        return;
      }

      const { yearlyDepreciationAmount } = calculateDepreciation(
        Number(depreciationCategory.percentage),
        Number(record.amount),
        record.activation_date,
        year,
        record.expiration_date ?? undefined,
      );

      switch (record.type) {
        case 'RESEARCH_AND_DEVELOPMENT':
          rndDepreciationYearlyAmount += yearlyDepreciationAmount;
          break;
        case 'GENERAL_AND_MANAGEMENT':
          gnmDepreciationYearlyAmount += yearlyDepreciationAmount;
          break;
        case 'MARKETING':
          marketingDepreciationYearlyAmount += yearlyDepreciationAmount;
          break;
        default:
          throw new GraphQLError(`Unknown depreciation record type ${record.type}`);
      }
    }),
  );

  const totalDepreciationYearlyAmount =
    rndDepreciationYearlyAmount + gnmDepreciationYearlyAmount + marketingDepreciationYearlyAmount;

  return {
    rndDepreciationYearlyAmount,
    gnmDepreciationYearlyAmount,
    marketingDepreciationYearlyAmount,
    totalDepreciationYearlyAmount,
  };
}
