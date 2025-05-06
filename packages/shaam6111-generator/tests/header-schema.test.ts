import { describe, expect, it } from 'vitest';
import { headerSchema } from '../src/schemas/index';

// Valid HeaderRecord example
const validHeaderRecord = {
  taxFileNumber: '123456789',
  taxYear: '2025',
  idNumber: '987654321',
  industryCode: '1234',
  businessType: 1, // INDUSTRIAL
  reportingMethod: 1, // CASH
  accountingMethod: 1, // SINGLE_ENTRY
  accountingSystem: 1, // MANUAL
  includesProfitLoss: 1, // YES
  includesTaxAdjustment: 1, // YES
  includesBalanceSheet: 1, // YES
  profitLossEntryCount: 10,
  currencyType: 1, // SHEKELS
  amountsInThousands: 1, // YES
};

describe('headerSchema', () => {
  it('should validate a valid HeaderRecord', () => {
    const result = headerSchema.safeParse(validHeaderRecord);
    expect(result.success).toBe(true);
  });

  it('should fail validation for an invalid taxFileNumber', () => {
    const invalidRecord = { ...validHeaderRecord, taxFileNumber: '123' };
    const result = headerSchema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Tax file number must be exactly 9 digits');
    }
  });

  it('should fail validation for a missing required field', () => {
    const { taxYear: _unused, ...invalidRecord } = validHeaderRecord;
    const result = headerSchema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Required');
    }
  });

  it('should fail validation for an invalid enum value', () => {
    const invalidRecord = { ...validHeaderRecord, businessType: 99 };
    const result = headerSchema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('Invalid enum value');
    }
  });

  it('should validate optional fields when provided', () => {
    const recordWithOptionalFields = {
      ...validHeaderRecord,
      vatFileNumber: '123456789',
      withholdingTaxFileNumber: '987654321',
      businessDescription: 'Industrial business',
      ifrsImplementationYear: '2025',
      ifrsReportingOption: 1, // OPTION_1
      softwareRegistrationNumber: '12345678',
      partnershipCount: 2,
      partnershipProfitShare: 50.25,
      auditOpinionType: 1, // UNQUALIFIED
    };
    const result = headerSchema.safeParse(recordWithOptionalFields);
    expect(result.success).toBe(true);
  });
});
