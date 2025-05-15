import { IndividualOrCompanyEnum, ReportData } from '../../../src/types/index.js';

/**
 * Valid test data for the validateData function
 */
export const validReportData1: ReportData = {
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
    profitLossEntryCount: 4,
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
    { code: 1450, amount: 25_000 },
    { code: 2095, amount: 75_000 },
    { code: 6666, amount: 250_000 },
  ],
  taxAdjustment: [
    { code: 100, amount: 250_000 },
    { code: 103, amount: 75_000 },
    { code: 104, amount: 10_000 },
    { code: 370, amount: 5000 },
    { code: 383, amount: 5000 },
    { code: 400, amount: 150_000 },
  ],
  balanceSheet: [
    { code: 6000, amount: 500_000 },
    { code: 7000, amount: 350_000 },
    { code: 7800, amount: 100_000 },
  ],
  individualOrCompany: IndividualOrCompanyEnum.COMPANY,
};
