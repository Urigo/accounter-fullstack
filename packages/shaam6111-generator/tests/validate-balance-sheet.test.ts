import { describe, expect, it } from 'vitest';
import { balanceSheetArraySchema } from '../src/schemas/balance-sheet';

// Valid balance sheet records example
const validBalanceSheetRecords = [
  { code: 7000, amount: 10_000 },
  { code: 7100, amount: 4000 },
  { code: 7150, amount: 4000 },
  { code: 7200, amount: 3000 },
  { code: 7295, amount: 3000 },
  { code: 7300, amount: 3000 },
  { code: 7310, amount: 3000 },
  { code: 7320, amount: 1000 },
  { code: 7380, amount: 1000 },
  { code: 8000, amount: 2000 },
  { code: 8020, amount: 100 },
  { code: 8105, amount: 900 },
  { code: 8110, amount: 500 },
  { code: 8170, amount: 2200 },
  { code: 8190, amount: 700 },
  { code: 8888, amount: 12_000 },
  { code: 9000, amount: 12_000 },
  { code: 9100, amount: 10_000 },
  { code: 9110, amount: 10_000 },
  { code: 9200, amount: 2000 },
  { code: 9210, amount: 2000 },
  { code: 9999, amount: 12_000 },
];

describe('balanceSheetArraySchema', () => {
  it('should validate valid balance sheet records', () => {
    const result = balanceSheetArraySchema.safeParse(validBalanceSheetRecords);
    expect(result.success).toBe(true);
  });

  it('should fail validation for an invalid code', () => {
    const invalidRecords = [...validBalanceSheetRecords, { code: 99_999, amount: 1000 }];
    const result = balanceSheetArraySchema.safeParse(invalidRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid balance sheet code: 99999');
    }
  });

  it('should fail validation for duplicate codes', () => {
    const duplicateRecords = [...validBalanceSheetRecords, { code: 7000, amount: 2000 }];
    const result = balanceSheetArraySchema.safeParse(duplicateRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Duplicate code');
    }
  });

  it('should fail validation for negative amounts on non-negative codes', () => {
    const invalidRecords = validBalanceSheetRecords.map(record => {
      if (record.code === 7100) {
        record.amount = -500; // Negative amount for a non-negative code
      }
      return record;
    });
    const result = balanceSheetArraySchema.safeParse(invalidRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('does not allow negative amounts');
    }
  });

  it('should validate records with correct total assets and liabilities + equity', () => {
    // Test validates the fundamental accounting equation: Total Assets (8888) = Total Liabilities + Equity (9999)
    // Both totals are set to 10_000 to ensure the balance sheet equation is satisfied
    const validRecordsWithTotals = [
      { code: 7000, amount: 10_000 },
      { code: 7600, amount: 10_000 },
      { code: 7610, amount: 10_000 },
      { code: 8888, amount: 10_000 },
      { code: 9000, amount: 10_000 },
      { code: 9500, amount: 10_000 },
      { code: 9520, amount: 10_000 },
      { code: 9999, amount: 10_000 },
    ];
    const result = balanceSheetArraySchema.safeParse(validRecordsWithTotals);
    expect(result.success).toBe(true);
  });

  it('should fail validation for mismatched total assets and liabilities + equity', () => {
    const invalidTotalsRecords = [
      { code: 7000, amount: 10_000 },
      { code: 7600, amount: 10_000 },
      { code: 7610, amount: 10_000 },
      { code: 8888, amount: 10_000 },
      { code: 9000, amount: 9000 },
      { code: 9500, amount: 9000 },
      { code: 9520, amount: 9000 },
      { code: 9999, amount: 9000 }, // Mismatched total
    ];
    const result = balanceSheetArraySchema.safeParse(invalidTotalsRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        'Total assets (8888) must equal total liabilities + equity (9999)',
      );
    }
  });

  it('should fail validation for missing required summary codes', () => {
    const missingSummaryRecords = validBalanceSheetRecords.filter(
      record => record.code >= 9000 && record.code < 9999,
    );
    const result = balanceSheetArraySchema.safeParse(missingSummaryRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Missing required summary code');
    }
  });
});
