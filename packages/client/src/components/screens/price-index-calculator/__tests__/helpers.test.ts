import { describe, expect, it } from 'vitest';
import { PriceIndexMode } from '../../../../gql/graphql.js';
import {
  calculatorInputSchema,
  defaultCalculatorInput,
  formatPeriod,
  formatShekels,
  formatSignedPercent,
  periodRange,
} from '../helpers.js';

describe('defaultCalculatorInput', () => {
  it('links 1,000 over the past year by the known index', () => {
    expect(defaultCalculatorInput(new Date(2026, 9, 22))).toEqual({
      amount: 1000,
      fromDate: '2025-10-22',
      fromMode: PriceIndexMode.Known,
      toDate: '2026-10-22',
      toMode: PriceIndexMode.Known,
    });
  });

  it('passes its own schema', () => {
    expect(calculatorInputSchema.safeParse(defaultCalculatorInput()).success).toBe(true);
  });
});

describe('calculatorInputSchema', () => {
  const valid = defaultCalculatorInput(new Date(2026, 9, 22));

  it('accepts a backwards range', () => {
    const input = { ...valid, fromDate: valid.toDate, toDate: valid.fromDate };
    expect(calculatorInputSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    ['a zero amount', { amount: 0 }],
    ['a negative amount', { amount: -5 }],
    ['a missing amount', { amount: undefined }],
    ['a malformed date', { fromDate: '22/10/2025' }],
    ['an unknown mode', { toMode: 'LATEST' }],
  ])('rejects %s', (_, override) => {
    expect(calculatorInputSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe('formatPeriod', () => {
  it('formats a YYYY-MM period', () => {
    expect(formatPeriod('2025-01')).toBe('Jan 2025');
    expect(formatPeriod('2024-12', "MMM ''yy")).toBe("Dec '24");
  });

  it('returns a malformed period as is', () => {
    expect(formatPeriod('2025-13')).toBe('2025-13');
    expect(formatPeriod('')).toBe('');
  });
});

describe('formatShekels', () => {
  it('formats amounts with a sign only where asked', () => {
    expect(formatShekels(1045.3)).toBe('₪1,045.30');
    expect(formatShekels(45.3, { signed: true })).toBe('+₪45.30');
    expect(formatShekels(-3.7, { signed: true })).toBe('−₪3.70');
    expect(formatShekels(-3.7)).toBe('−₪3.70');
  });

  it('drops the sign of a value that rounds to zero', () => {
    expect(formatShekels(-0.001, { signed: true })).toBe('₪0.00');
    expect(formatShekels(0.004, { signed: true })).toBe('₪0.00');
  });
});

describe('formatSignedPercent', () => {
  it('always signs a non-zero change', () => {
    expect(formatSignedPercent(4.5321)).toBe('+4.53%');
    expect(formatSignedPercent(-0.37)).toBe('−0.37%');
    expect(formatSignedPercent(0.3, 1)).toBe('+0.3%');
    expect(formatSignedPercent(0)).toBe('0.00%');
  });
});

describe('periodRange', () => {
  it('orders two periods ascending', () => {
    expect(periodRange('2024-11', '2026-08')).toEqual(['2024-11', '2026-08']);
    expect(periodRange('2026-08', '2024-11')).toEqual(['2024-11', '2026-08']);
  });
});
