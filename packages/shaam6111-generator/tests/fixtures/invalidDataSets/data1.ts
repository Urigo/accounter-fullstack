import { IndividualOrCompanyEnum, ReportData } from '../../../src/types/index.js';

/**
 * Invalid test data for the validateData function.
 * Contains several validation errors:
 * 1. profitLossEntryCount doesn't match actual number of entries
 * 2. Code 6666 in profitAndLoss doesn't match code 100 in taxAdjustment
 * 3. Sum of codes 1450 and 2095 doesn't equal balance sheet code 7800
 */
export const invalidReportData1: ReportData = {
  header: {
    taxFileNumber: '123456789',
    taxYear: '2025',
    idNumber: '987654321',
    vatFileNumber: '123456789',
    withholdingTaxFileNumber: '987654321',
    industryCode: '1234',
    businessDescription: 'Tech Company Ltd',
    businessType: 2,
    reportingMethod: 2,
    accountingMethod: 2,
    accountingSystem: 2,
    isPartnership: 2,
    includesProfitLoss: 1,
    includesTaxAdjustment: 1,
    includesBalanceSheet: 1,
    profitLossEntryCount: 3, // Error: Actual count is 4
    taxAdjustmentEntryCount: 6,
    balanceSheetEntryCount: 3,
    ifrsImplementationYear: '2023',
    ifrsReportingOption: 9,
    softwareRegistrationNumber: '12345678',
    partnershipCount: 0,
    partnershipProfitShare: 0,
    currencyType: 1,
    auditOpinionType: 1,
    amountsInThousands: 2,
  },
  profitAndLoss: [
    { code: 1001, amount: 100_000 },
    { code: 1450, amount: 25_000 }, // Sum with 2095 should equal 7800, but doesn't
    { code: 2095, amount: 75_000 },
    { code: 6666, amount: 250_000 }, // Should equal code 100 in taxAdjustment, but doesn't
  ],
  taxAdjustment: [
    { code: 100, amount: 350_000 }, // Error: Doesn't match code 6666 in profitAndLoss
    { code: 103, amount: 75_000 },
    { code: 104, amount: 10_000 },
    { code: 370, amount: 5000 },
    { code: 383, amount: 5000 },
    { code: 400, amount: 150_000 },
  ],
  balanceSheet: [
    { code: 6000, amount: 500_000 },
    { code: 7000, amount: 350_000 },
    { code: 7800, amount: 150_000 }, // Error: Should equal sum of codes 1450 and 2095 (100000), but doesn't
  ],
  individualOrCompany: IndividualOrCompanyEnum.COMPANY,
};
