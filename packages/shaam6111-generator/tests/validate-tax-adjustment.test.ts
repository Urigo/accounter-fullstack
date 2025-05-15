import { describe, expect, it } from 'vitest';
import { taxAdjustmentArraySchema } from '../src/schemas/tax-adjustment';

// Valid tax adjustment records example
const validTaxAdjustmentRecords = [
  { code: 110, amount: 5000 },
  { code: 120, amount: 3000 },
  { code: 130, amount: 2000 },
  { code: 140, amount: 1000 },
  { code: 150, amount: 1500 },
  { code: 370, amount: 2500 },
  { code: 400, amount: 2000 },
  { code: 430, amount: 1000 },
  { code: 480, amount: 500 },
  { code: 490, amount: 700 },
  { code: 500, amount: 1200 },
];

describe('taxAdjustmentArraySchema', () => {
  it('should validate valid tax adjustment records', () => {
    const result = taxAdjustmentArraySchema.safeParse(validTaxAdjustmentRecords);
    expect(result.success).toBe(true);
  });

  it('should fail validation for an invalid code', () => {
    const invalidRecords = [...validTaxAdjustmentRecords, { code: 9999, amount: 1000 }];
    const result = taxAdjustmentArraySchema.safeParse(invalidRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Invalid code for tax adjustment section');
    }
  });

  it('should fail validation for duplicate codes', () => {
    const duplicateRecords = [...validTaxAdjustmentRecords, { code: 110, amount: 2000 }];
    const result = taxAdjustmentArraySchema.safeParse(duplicateRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('Duplicate code');
    }
  });

  it('should fail validation for negative amounts on non-negative codes', () => {
    const invalidRecords = validTaxAdjustmentRecords.map(record =>
      record.code === 110
        ? { code: 110, amount: -500 }
        : record.code === 370
          ? { code: 370, amount: -3000 }
          : record,
    );
    const result = taxAdjustmentArraySchema.safeParse(invalidRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('does not allow negative amounts');
    }
  });

  it('should validate records with correct summary calculations', () => {
    const validRecordsWithSummary = [
      { code: 110, amount: 5000 },
      { code: 120, amount: 3000 },
      { code: 370, amount: 2000 },
    ];
    const result = taxAdjustmentArraySchema.safeParse(validRecordsWithSummary);
    expect(result.success).toBe(true);
  });

  it('should fail validation for incorrect summary calculations', () => {
    const invalidSummaryRecords = [
      { code: 110, amount: 5000 },
      { code: 120, amount: 3000 },
      { code: 370, amount: 1000 }, // Incorrect summary
    ];
    const result = taxAdjustmentArraySchema.safeParse(invalidSummaryRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('should equal the sum');
    }
  });
});
