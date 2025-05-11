import { generateHeaderRecord } from '../src/generators/header';
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
    console.log(result);
    expect(
      result.startsWith(
        '00012345520250987654310000000000000000001234ניסיון!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!010101010121000000000999909999999999999999901002',
      ),
    ).toBe(true);
  });
});
