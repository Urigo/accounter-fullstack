import { format, subYears } from 'date-fns';
import { z } from 'zod';
import { PriceIndexMode } from '../../../gql/graphql.js';
import {
  formatStringifyAmount,
  formatTimelessDateString,
  TIMELESS_DATE_REGEX,
  type TimelessDateString,
} from '../../../helpers/index.js';

/** URL query parameter the submitted calculation is persisted under. */
export const CPI_CALCULATOR_PARAM = 'cpiCalculator';

const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const timelessDateString = z.custom<TimelessDateString>(
  value => typeof value === 'string' && TIMELESS_DATE_REGEX.test(value),
  { error: 'Pick a valid date' },
);

export type CalculatorInput = {
  amount: number;
  fromDate: TimelessDateString;
  fromMode: PriceIndexMode;
  toDate: TimelessDateString;
  toMode: PriceIndexMode;
};

/**
 * A linkage calculation. Shared by the form (validation) and the URL parameter (a stale or
 * hand-edited link falls back to the defaults). Either date may come first: linking backwards
 * deflates an amount to an earlier date's prices.
 */
export const calculatorInputSchema: z.ZodType<CalculatorInput, CalculatorInput> = z.object({
  amount: z
    .number({ error: 'Enter an amount' })
    .positive({ error: 'Amount must be greater than zero' }),
  fromDate: timelessDateString,
  fromMode: z.enum(PriceIndexMode),
  toDate: timelessDateString,
  toMode: z.enum(PriceIndexMode),
});

/** 1,000 linked over the past year, by the known index on each side */
export function defaultCalculatorInput(today: Date = new Date()): CalculatorInput {
  return {
    amount: 1000,
    fromDate: formatTimelessDateString(subYears(today, 1)),
    fromMode: PriceIndexMode.Known,
    toDate: formatTimelessDateString(today),
    toMode: PriceIndexMode.Known,
  };
}

export const PRICE_INDEX_MODE_LABELS: Record<PriceIndexMode, { label: string; hint: string }> = {
  [PriceIndexMode.Known]: {
    label: 'Known index',
    hint: 'The index last published before this date (Income Tax Ordinance §88)',
  },
  [PriceIndexMode.ForPeriod]: {
    label: 'Index for period',
    hint: "The index for this date's month",
  },
};

/** `2025-01` → `Jan 2025`; anything that isn't a `YYYY-MM` period is returned as is */
export function formatPeriod(period: string, pattern: 'MMM yyyy' | "MMM ''yy" = 'MMM yyyy') {
  if (!YEAR_MONTH_REGEX.test(period)) {
    return period;
  }
  const [year, month] = period.split('-').map(Number);
  return format(new Date(year, month - 1, 1), pattern);
}

/** Prefixes a sign by the value as displayed, so a value that rounds to zero carries none */
function withSign(value: number, digits: number, signed: boolean, formatted: string): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded < 0) {
    return `−${formatted}`;
  }
  return signed && rounded > 0 ? `+${formatted}` : formatted;
}

export function formatShekels(amount: number, { signed = false } = {}): string {
  return withSign(amount, 2, signed, `₪${formatStringifyAmount(Math.abs(amount))}`);
}

export function formatSignedPercent(percent: number, digits = 2): string {
  return withSign(percent, digits, true, `${formatStringifyAmount(Math.abs(percent), digits)}%`);
}

/** The two periods as an ascending `[from, to]` range, whichever order they came in */
export function periodRange(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}
