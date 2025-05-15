import {
  addDays,
  differenceInDays,
  endOfYear,
  getDaysInYear,
  getYear,
  isAfter,
  isBefore,
  isSameYear,
  startOfYear,
} from 'date-fns';
import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { DepreciationCategoriesProvider } from '@modules/depreciation/providers/depreciation-categories.provider.js';
import { DepreciationProvider } from '@modules/depreciation/providers/depreciation.provider.js';

/**
 * Calculates depreciation amounts for accounting purposes
 * @param depreciationRate - Annual depreciation rate (e.g., 0.07 for 7%)
 * @param value - Initial value of the asset in USD
 * @param activationDate - Date when the asset depreciation began
 * @param calculationYear - Year for which to calculate depreciation (as of December 31st)
 * @param depreciationEndDate - Optional date when depreciation ends (e.g., asset sold)
 * @returns Object containing yearly depreciation amount and past depreciation amount
 */
export function calculateDepreciation(
  depreciationRate: number,
  value: number,
  activationDate: Date,
  calculationYear: number,
  depreciationEndDate?: Date,
): {
  yearlyDepreciationAmount: number;
  yearlyDepreciationRate: number;
  pastDepreciationAmount: number;
} {
  // Normalize depreciation rate (convert percentage to decimal)
  const normalizedRate = depreciationRate / 100;

  // Calculate end date if not provided
  if (!depreciationEndDate) {
    const yearsToFullDepreciation = 1 / normalizedRate;
    const activationYear = getYear(activationDate);
    const fullDepreciationYear = activationYear + Math.ceil(yearsToFullDepreciation);

    // Calculate proportional days for the fractional year
    const fullYears = Math.floor(yearsToFullDepreciation);
    const fractionalYear = yearsToFullDepreciation - fullYears;

    if (fractionalYear > 0) {
      const daysInFinalYear = getDaysInYear(new Date(fullDepreciationYear, 0, 1));
      const daysToAdd = Math.ceil(fractionalYear * daysInFinalYear);
      depreciationEndDate = addDays(new Date(fullDepreciationYear, 0, 1), daysToAdd - 1);
    } else {
      depreciationEndDate = new Date(fullDepreciationYear, 0, 0); // Last day of previous year
    }
  }

  // Create calculation date as December 31st of the calculation year
  const calculationDate = new Date(calculationYear, 11, 31);
  const startOfCalculationYear = startOfYear(calculationDate);

  // If calculation date is before activation date, no depreciation applies
  if (isAfter(activationDate, calculationDate)) {
    return { yearlyDepreciationAmount: 0, yearlyDepreciationRate: 0, pastDepreciationAmount: 0 };
  }

  // If depreciation ended before the calculation year, no yearly depreciation
  if (isBefore(depreciationEndDate, startOfCalculationYear)) {
    // Calculate total depreciation up to the end date
    const totalYearsActive = differenceInDays(depreciationEndDate, activationDate) / 365.25;
    const totalDepreciation = Math.min(value, value * normalizedRate * totalYearsActive);

    return {
      yearlyDepreciationAmount: 0,
      yearlyDepreciationRate: 0,
      pastDepreciationAmount: totalDepreciation,
    };
  }

  // Calculate annual depreciation amount
  const annualDepreciationAmount = value * normalizedRate;

  // Handle different cases for calculation
  const activationYear = getYear(activationDate);
  const effectiveEndDate = isBefore(depreciationEndDate, calculationDate)
    ? depreciationEndDate
    : calculationDate;

  // Calculate past depreciation (up to the start of calculation year)
  let pastDepreciationAmount = 0;

  if (activationYear < calculationYear) {
    // Full years before calculation year
    const fullYearsBeforeCalculation = calculationYear - activationYear - 1;

    if (fullYearsBeforeCalculation > 0) {
      pastDepreciationAmount += fullYearsBeforeCalculation * annualDepreciationAmount;
    }

    // Add partial year for activation year
    const daysInActivationYear = getDaysInYear(activationDate);
    const daysActiveInFirstYear = differenceInDays(endOfYear(activationDate), activationDate) + 1;
    pastDepreciationAmount +=
      annualDepreciationAmount * (daysActiveInFirstYear / daysInActivationYear);
  }

  // Cap past depreciation at asset value
  pastDepreciationAmount = Math.min(pastDepreciationAmount, value);

  // Calculate depreciation for the calculation year
  let yearlyDepreciationAmount = 0;

  if (activationYear === calculationYear) {
    // Asset activated during calculation year
    const daysInYear = getDaysInYear(calculationDate);
    const daysActive = differenceInDays(effectiveEndDate, activationDate) + 1;
    yearlyDepreciationAmount = annualDepreciationAmount * (daysActive / daysInYear);
  } else if (isSameYear(depreciationEndDate, calculationDate)) {
    // Asset depreciation ended during calculation year
    const daysInYear = getDaysInYear(calculationDate);
    const daysActive = differenceInDays(depreciationEndDate, startOfCalculationYear) + 1;
    yearlyDepreciationAmount = annualDepreciationAmount * (daysActive / daysInYear);
  } else {
    // Asset active for the full calculation year
    yearlyDepreciationAmount = annualDepreciationAmount;
  }

  // Ensure we don't depreciate more than the remaining value
  const remainingValue = Math.max(0, value - pastDepreciationAmount);
  yearlyDepreciationAmount = Math.min(yearlyDepreciationAmount, remainingValue);

  return {
    yearlyDepreciationAmount,
    yearlyDepreciationRate:
      depreciationRate * (yearlyDepreciationAmount / annualDepreciationAmount),
    pastDepreciationAmount,
  };
}

export async function calculateDepreciationAmount(injector: Injector, year: number) {
  const yearBeginning = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const depreciationRecords = await injector
    .get(DepreciationProvider)
    .getDepreciationRecordsByDates({
      fromDate: yearBeginning,
      toDate: yearEnd,
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
