import { describe, expect, it } from 'vitest';
import { headerSchema } from '../src/schemas/index';

// Valid HeaderRecord example
const validHeaderRecord = {
  taxFileNumber: '123456782',
  taxYear: '2025',
  idNumber: '987654324',
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
      expect(result.error.issues[0].message).toBe('Tax file number must include at least 5 digits');
    }
  });

  it('should fail validation for a missing required field', () => {
    const { taxYear: _unused, ...invalidRecord } = validHeaderRecord;
    const result = headerSchema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Invalid input: expected string, received undefined',
      );
    }
  });

  it('should fail validation for an invalid enum value', () => {
    const invalidRecord = { ...validHeaderRecord, businessType: 55 };
    const result = headerSchema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Invalid option: expected one of');
    }
  });

  it('should fail validation for an invalid idNumber', () => {
    const invalidRecord = { ...validHeaderRecord, idNumber: '123456789' };
    const result = headerSchema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid ID number');
    }
  });

  it('should validate optional fields when provided', () => {
    const recordWithOptionalFields = {
      ...validHeaderRecord,
      vatFileNumber: '123456782',
      withholdingTaxFileNumber: '987654324',
      businessDescription: 'Industrial business',
      ifrsImplementationYear: '2025',
      ifrsReportingOption: 1, // OPTION_1
      softwareRegistrationNumber: '12345678',
      partnershipCount: 2,
      partnershipProfitShare: 50,
      auditOpinionType: 1, // UNQUALIFIED
    };
    const result = headerSchema.safeParse(recordWithOptionalFields);
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data;
      expect(data.vatFileNumber).toBe('123456782');
      expect(data.withholdingTaxFileNumber).toBe('987654324');
      expect(data.businessDescription).toBe('Industrial business');
      expect(data.ifrsImplementationYear).toBe('2025');
      expect(data.ifrsReportingOption).toBe(1);
      expect(data.softwareRegistrationNumber).toBe('12345678');
      expect(data.partnershipCount).toBe(2);
      expect(data.partnershipProfitShare).toBe(50);
      expect(data.auditOpinionType).toBe(1);
    }
  });

  it('should fail validation for an invalid partnershipCount', () => {
    const invalidRecord = { ...validHeaderRecord, partnershipCount: -1 };
    const result = headerSchema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Partnership count cannot be negative');
    }
  });

  it('should fail validation for an invalid tax year', () => {
    const invalidRecord = { ...validHeaderRecord, taxYear: '20X5' };
    const result = headerSchema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Tax year must contain only digits');
    }
  });

  it('should fail validation for an industry code not exactly 4 digits', () => {
    const invalidRecord = { ...validHeaderRecord, industryCode: '123' };
    const result = headerSchema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Industry code must be exactly 4 digits');
    }
  });

  it('should fail validation for a business description exceeding 50 characters', () => {
    const invalidRecord = {
      ...validHeaderRecord,
      businessDescription: 'A'.repeat(51),
    };
    const result = headerSchema.safeParse(invalidRecord);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Business description cannot exceed 50 characters',
      );
    }
  });
});
