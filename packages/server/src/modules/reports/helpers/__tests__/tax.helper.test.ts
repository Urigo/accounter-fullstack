import { describe, expect, it } from 'vitest';
import { computeCurrentTax } from '../tax.helper.js';

const rates = { taxRate: 0.12, specialTaxRate: 0.23 };

describe('computeCurrentTax', () => {
  it('books no tax in a loss year and reports the taxable loss', () => {
    const result = computeCurrentTax({
      ...rates,
      taxableIncomeAmount: -1_000_000,
      specialTaxableIncomeAmount: 0,
    });
    expect(result.annualTaxExpenseAmount).toBeCloseTo(-120_000);
    expect(result.currentTaxExpense).toBe(0);
    expect(result.taxableLoss).toBe(1_000_000);
    expect(result.mixedRateLoss).toBe(false);
  });

  it('books no tax and no loss when taxable income is exactly zero', () => {
    const result = computeCurrentTax({
      ...rates,
      taxableIncomeAmount: 0,
      specialTaxableIncomeAmount: 0,
    });
    expect(result.currentTaxExpense).toBe(0);
    expect(result.taxableLoss).toBe(0);
    expect(result.mixedRateLoss).toBe(false);
  });

  it('keeps profit-year amounts unchanged', () => {
    const result = computeCurrentTax({
      ...rates,
      taxableIncomeAmount: 1_000_000,
      specialTaxableIncomeAmount: 100_000,
    });
    expect(result.annualTaxExpenseAmount).toBeCloseTo(143_000);
    expect(result.currentTaxExpense).toBeCloseTo(143_000);
    expect(result.taxableLoss).toBe(0);
    expect(result.mixedRateLoss).toBe(false);
  });

  it('flags a preferred-rate loss with a sort-991 profit', () => {
    const result = computeCurrentTax({
      ...rates,
      taxableIncomeAmount: -500_000,
      specialTaxableIncomeAmount: 100_000,
    });
    expect(result.mixedRateLoss).toBe(true);
    expect(result.currentTaxExpense).toBe(0);
    expect(result.taxableLoss).toBe(400_000);
  });

  it('flags a preferred-rate profit with a sort-991 loss', () => {
    const result = computeCurrentTax({
      ...rates,
      taxableIncomeAmount: 500_000,
      specialTaxableIncomeAmount: -100_000,
    });
    expect(result.mixedRateLoss).toBe(true);
    expect(result.currentTaxExpense).toBeCloseTo(37_000);
    expect(result.taxableLoss).toBe(0);
  });
});
