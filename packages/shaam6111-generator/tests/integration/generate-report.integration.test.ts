import { generateReport } from '../../src/generators/generate-report';
import { IndividualOrCompanyEnum, ReportData, ValidationError } from '../../src/types';

describe('Integration Test: generateReport', () => {
  it('should generate a full report string of the correct length and format', () => {
    const mockReportData: ReportData = {
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
        profitLossEntryCount: 10,
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
      individualOrCompany: IndividualOrCompanyEnum.COMPANY,
    };

    const result = generateReport(mockReportData);

    // Validate the length of the generated report
    expect(result.length).toBe(8612);

    // Validate specific sections of the report
    expect(result.startsWith('1234567822025987654324')).toBe(true); // Header section
    expect(
      result.includes(
        '010000000000100000010400000000100000013000000000030000013710000000030000066660000000070000000000000000000000',
      ),
    ).toBe(true); // Profit and Loss section
    expect(result.includes('001100000000005000001200000000003000000000000000000000')).toBe(true); // Tax Adjustment section
    expect(
      result.includes(
        '070000000000010000077000000000006000077110000000006000071000000000004000071500000000004000088880000000010000090000000000010000091000000000005000091400000000005000093600000000005000094000000000005000099990000000010000000000000000000000',
      ),
    ).toBe(true); // Balance Sheet section
  });

  it('should throw an error for invalid report data', () => {
    const invalidReportData = {
      header: {
        taxFileNumber: '123', // Invalid length
        taxYear: '20', // Invalid length
        idNumber: '987654324',
        industryCode: '1234',
        businessType: 1,
        reportingMethod: 1,
        accountingMethod: 1,
        accountingSystem: 1,
        includesProfitLoss: 1,
        includesTaxAdjustment: 1,
        includesBalanceSheet: 1,
        profitLossEntryCount: 2,
        taxAdjustmentEntryCount: 2,
        balanceSheetEntryCount: 2,
      },
      profitAndLoss: [{ code: 1000, amount: 12_345 }],
      taxAdjustment: [{ code: 100, amount: 56_789 }],
      balanceSheet: [
        { code: 3001, amount: 34_567 },
        { code: 3002, amount: 12_345 },
      ],
      individualOrCompany: IndividualOrCompanyEnum.INDIVIDUAL, // Corrected enum value
    } as ReportData;

    try {
      const report = generateReport(invalidReportData);
      expect(report).toBeUndefined(); // Expect the report to be undefined
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      // TODO: validate the error message
    }
  });
});
