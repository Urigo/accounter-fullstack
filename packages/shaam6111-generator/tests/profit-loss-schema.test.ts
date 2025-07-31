import { describe, expect, it } from 'vitest';
import { profitLossArraySchema } from '../src/schemas/profit-and-loss';

// Valid profit and loss records example
const validProfitLossRecords = [
  { code: 1052, amount: 5000 },
  { code: 1000, amount: 5000 },
  { code: 1300, amount: 3000 },
  { code: 1350, amount: 1000 },
  { code: 1390, amount: 2000 },
  { code: 2000, amount: 2000 },
  { code: 2011, amount: 500 },
  { code: 2012, amount: 1500 },
  { code: 2500, amount: 1000 },
  { code: 2510, amount: 1000 },
  { code: 3000, amount: 1500 },
  { code: 3020, amount: 1000 },
  { code: 3025, amount: 500 },
  { code: 3530, amount: 2500 },
  { code: 3500, amount: 2500 },
  { code: 5000, amount: 1000 },
  { code: 5030, amount: 200 },
  { code: 5040, amount: 400 },
  { code: 5050, amount: 400 },
  { code: 5122, amount: 500 },
  { code: 5100, amount: 500 },
  { code: 5200, amount: 700 },
  { code: 5210, amount: 100 },
  { code: 5220, amount: 100 },
  { code: 5230, amount: 100 },
  { code: 5236, amount: 100 },
  { code: 5237, amount: 100 },
  { code: 5240, amount: 100 },
  { code: 5250, amount: 100 },
  { code: 5300, amount: 300 },
  { code: 5390, amount: 300 },
  { code: 6666, amount: -3100 },
];

describe('profitLossArraySchema', () => {
  it('should validate valid profit and loss records', () => {
    const result = profitLossArraySchema.safeParse(validProfitLossRecords);
    expect(result.success).toBe(true);
  });

  it('should fail validation for an invalid code', () => {
    const invalidRecords = [...validProfitLossRecords, { code: 9999, amount: 1000 }];
    const result = profitLossArraySchema.safeParse(invalidRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid profit and loss code');
    }
  });

  it('should fail validation for duplicate codes', () => {
    const duplicateRecords = [...validProfitLossRecords, { code: 1000, amount: 2000 }];
    const result = profitLossArraySchema.safeParse(duplicateRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Duplicate code');
    }
  });

  it('should fail validation for negative amounts on non-negative codes', () => {
    const invalidRecords = validProfitLossRecords.map(record =>
      [1000, 1052].includes(record.code) ? { code: record.code, amount: -500 } : record,
    );
    const result = profitLossArraySchema.safeParse(invalidRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('does not allow negative amounts');
    }
  });

  it('should validate records with optional fields and correct summary calculations', () => {
    const validRecordsWithSummary = [
      { code: 1000, amount: 5000 },
      { code: 1010, amount: 5000 },
      { code: 1300, amount: 3000 },
      { code: 1306, amount: 3000 },
      { code: 6666, amount: 2000 },
    ];
    const result = profitLossArraySchema.safeParse(validRecordsWithSummary);
    expect(result.success).toBe(true);
  });

  it('should fail validation for incorrect summary calculations', () => {
    const invalidSummaryRecords = [
      { code: 1000, amount: 5000 },
      { code: 1010, amount: 5000 },
      { code: 1300, amount: 3000 },
      { code: 1306, amount: 3000 },
      { code: 6666, amount: 1000 }, // Incorrect summary
    ];
    const result = profitLossArraySchema.safeParse(invalidSummaryRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('should equal the sum');
    }
  });
});
