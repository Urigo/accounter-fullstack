import { generateHeaderRecord } from '../src/generators/generate-header';
import {
  AccountingMethod,
  AccountingSystem,
  BusinessType,
  CurrencyType,
  HeaderRecord,
  ReportingMethod,
  YesNo,
} from '../src/types/header';

describe('generateHeaderRecord', () => {
  it('should generate a string of the correct length', () => {
    const header: HeaderRecord = {
      taxFileNumber: '123456782',
      taxYear: '2025',
      idNumber: '987654324',
      industryCode: '1234',
      businessType: BusinessType.INDUSTRIAL,
      reportingMethod: ReportingMethod.CASH,
      accountingMethod: AccountingMethod.SINGLE_ENTRY,
      accountingSystem: AccountingSystem.MANUAL,
      includesProfitLoss: YesNo.YES,
      includesTaxAdjustment: YesNo.NO,
      includesBalanceSheet: YesNo.YES,
      currencyType: CurrencyType.SHEKELS,
      amountsInThousands: YesNo.NO,
    };

    const result = generateHeaderRecord(header);
    expect(result.length).toBe(142);
  });

  it('should format fields correctly', () => {
    const header: HeaderRecord = {
      taxFileNumber: '123456782',
      taxYear: '2025',
      idNumber: '987654324',
      industryCode: '1234',
      businessType: BusinessType.INDUSTRIAL,
      reportingMethod: ReportingMethod.CASH,
      accountingMethod: AccountingMethod.SINGLE_ENTRY,
      accountingSystem: AccountingSystem.MANUAL,
      includesProfitLoss: YesNo.YES,
      includesTaxAdjustment: YesNo.NO,
      includesBalanceSheet: YesNo.YES,
      currencyType: CurrencyType.SHEKELS,
      amountsInThousands: YesNo.NO,
    };

    const result = generateHeaderRecord(header);
    expect(result.startsWith('1234567822025987654324')).toBe(true);
    expect(result.includes('1234')).toBe(true);
  });

  // test: padding should work correctly
  it('should pad fields correctly', () => {
    const header: HeaderRecord = {
      taxFileNumber: '123455',
      taxYear: '2025',
      idNumber: '98765431',
      industryCode: '1234',
      businessDescription: 'ניסיון',
      businessType: BusinessType.INDUSTRIAL,
      reportingMethod: ReportingMethod.CASH,
      accountingMethod: AccountingMethod.SINGLE_ENTRY,
      accountingSystem: AccountingSystem.MANUAL,
      includesProfitLoss: YesNo.YES,
      includesTaxAdjustment: YesNo.NO,
      includesBalanceSheet: YesNo.YES,
      currencyType: CurrencyType.SHEKELS,
      amountsInThousands: YesNo.NO,
    };

    const result = generateHeaderRecord(header);

    // Check specific parts of the result
    expect(result.substring(0, 9)).toBe('000123455'); // taxFileNumber
    expect(result.substring(9, 13)).toBe('2025'); // taxYear
    expect(result.substring(13, 22)).toBe('098765431'); // idNumber

    // Check the Hebrew business description and its padding
    const businessDescriptionStart = 44; // Index where business description starts
    expect(result.substring(businessDescriptionStart, businessDescriptionStart + 6)).toBe('ניסיון');
    expect(result.substring(businessDescriptionStart + 6, businessDescriptionStart + 50)).toMatch(
      / +/,
    ); // Check padding

    // Verify overall length is still correct
    expect(result.length).toBe(142);
  });
});
