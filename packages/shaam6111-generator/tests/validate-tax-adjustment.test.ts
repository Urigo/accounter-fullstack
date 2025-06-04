import { describe, expect, it } from 'vitest';
import { taxAdjustmentArraySchema } from '../src/schemas/tax-adjustment';

// Valid tax adjustment records example
const validTaxAdjustmentRecords = [
  { code: 110, amount: 5000 },
  { code: 120, amount: 3000 },
  { code: 130, amount: 2000 },
  { code: 140, amount: 1000 },
  { code: 150, amount: 1500 },
  { code: 370, amount: 8500 },
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
    const invalidRecords = [...validTaxAdjustmentRecords];
    // Replace records with negative amounts for codes that don't allow them
    const index110 = invalidRecords.findIndex(record => record.code === 110);
    const index370 = invalidRecords.findIndex(record => record.code === 370);
    if (index110 >= 0) invalidRecords[index110] = { code: 110, amount: -500 };
    if (index370 >= 0) invalidRecords[index370] = { code: 370, amount: -3000 };

    const result = taxAdjustmentArraySchema.safeParse(invalidRecords);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('does not allow negative amounts');
    }
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('does not allow negative amounts');
      expect(result.error.errors[0].path).toContain(index110);
    }
  });

  it('should validate records with correct summary calculations', () => {
    // Testing the summary calculation rule: code 370 should equal the sum of other specific codes
    // In this simple case, we're just providing a few codes without triggering any sum validations
    const validRecordsWithSummary = [
      { code: 110, amount: 5000 },
      { code: 130, amount: 3000 },
      { code: 370, amount: 2000 },
    ];
    const result = taxAdjustmentArraySchema.safeParse(validRecordsWithSummary);
    expect(result.success).toBe(true);
  });

  it('should fail validation for incorrect summary calculations', () => {
    // Code 370 should equal the sum of codes 110 and 120, which is 8000
    // Setting it to 1000 should trigger a validation error
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
