import { describe, expect, it } from 'vitest';
import { validateData } from '../../src';
import { IndividualOrCompanyEnum, ReportData } from '../../src/types';

// Mock data for testing
const validReportData: ReportData = {
  header: {
    taxFileNumber: '123456782',
    taxYear: '2025',
    idNumber: '987654324',
    industryCode: '1234',
    businessType: 1,
    reportingMethod: 1,
    accountingMethod: 1,
    accountingSystem: 1,
    includesProfitLoss: 1,
    includesTaxAdjustment: 1,
    includesBalanceSheet: 1,
    profitLossEntryCount: 5,
    taxAdjustmentEntryCount: 4,
    balanceSheetEntryCount: 12,
    currencyType: 1,
    amountsInThousands: 1,
  },
  profitAndLoss: [
    { code: 1000, amount: 100_000 },
    { code: 1040, amount: 100_000 },
    { code: 1300, amount: 30_000 },
    { code: 1371, amount: 30_000 },
    { code: 6666, amount: 70_000 },
  ],
  taxAdjustment: [
    { code: 100, amount: 70_000 },
    { code: 104, amount: 70_000 },
    { code: 110, amount: 5000 },
    { code: 120, amount: 3000 },
  ],
  balanceSheet: [
    { code: 7000, amount: 10_000 },
    { code: 7700, amount: 6000 },
    { code: 7711, amount: 6000 },
    { code: 7100, amount: 4000 },
    { code: 7150, amount: 4000 },
    { code: 8888, amount: 10_000 },
    { code: 9000, amount: 10_000 },
    { code: 9100, amount: 5000 },
    { code: 9140, amount: 5000 },
    { code: 9360, amount: 5000 },
    { code: 9400, amount: 5000 },
    { code: 9999, amount: 10_000 },
  ],
  individualOrCompany: IndividualOrCompanyEnum.INDIVIDUAL,
};

const invalidReportData = {
  header: {
    taxFileNumber: '123', // Invalid length
    taxYear: '20X5', // Invalid format
    idNumber: '987654324',
    industryCode: '1234',
    businessType: 1,
    reportingMethod: 1,
    accountingMethod: 1,
    accountingSystem: 1,
    includesProfitLoss: 1,
    includesTaxAdjustment: 1,
    includesBalanceSheet: 1,
    profitLossEntryCount: 10,
    currencyType: 1,
    amountsInThousands: 1,
  },
  profitAndLoss: [
    { code: 1000, amount: 100_000 },
    { code: 1040, amount: 100_000 },
    { code: 1300, amount: 30_000 },
    { code: 1371, amount: 30_000 },
    { code: 6666, amount: 50_000 }, // Invalid total
  ],
  taxAdjustment: [
    { code: 110, amount: 5000 },
    { code: 120, amount: -3000 }, // Negative amount
  ],
  balanceSheet: [
    { code: 7000, amount: 10_000 },
    { code: 7700, amount: 6000 },
    { code: 7711, amount: 6000 },
    { code: 7100, amount: '4000' }, // Invalid type
    { code: 7150, amount: 4000 },
    { code: 8888, amount: 10_000 },
    { code: 9000, amount: 10_000 },
    { code: 9100, amount: 5000 },
    { code: 9140, amount: 5000 },
    { code: 9360, amount: 5000 },
    { code: 9400, amount: 5000 },
    { code: 9999, amount: 10_000 },
  ],
  individualOrCompany: IndividualOrCompanyEnum.INDIVIDUAL,
};

describe('validateData', () => {
  it('should validate a valid ReportData object', () => {
    const result = validateData(validReportData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return errors for an invalid ReportData object', () => {
    const result = validateData(invalidReportData as ReportData);
    expect(result.isValid).toBe(false);
    expect(result.errors).not.toHaveLength(0);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'header.taxFileNumber' }),
        expect.objectContaining({ path: 'header.taxYear' }),
        expect.objectContaining({ path: 'profitAndLoss.4.amount' }),
        expect.objectContaining({ path: 'taxAdjustment.1.amount' }),
        expect.objectContaining({ path: 'balanceSheet.3.amount' }),
      ]),
    );
  });
});
