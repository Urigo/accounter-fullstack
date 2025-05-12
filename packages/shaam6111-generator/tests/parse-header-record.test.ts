import { parseHeaderRecord } from '../src/parsers/parse-header';
import {
  AccountingMethod,
  AccountingSystem,
  BusinessType,
  CurrencyType,
  ReportingMethod,
  YesNo,
} from '../src/types';

describe('parseHeaderRecord', () => {
  // Test for valid header line
  it('should correctly parse a valid header line', () => {
    // Create a sample valid header line
    const validHeaderLine =
      '123456789' + // taxFileNumber
      '2025' + // taxYear
      '987654321' + // idNumber
      '123456789' + // vatFileNumber
      '987654321' + // withholdingTaxFileNumber
      '1234' + // industryCode
      'Tech Company                                      ' + // businessDescription
      '01' + // businessType
      '01' + // reportingMethod
      '01' + // accountingMethod
      '01' + // accountingSystem
      '1' + // isPartnership
      '1' + // includesProfitLoss
      '1' + // includesTaxAdjustment
      '1' + // includesBalanceSheet
      '010' + // profitLossEntryCount
      '020' + // taxAdjustmentEntryCount
      '030' + // balanceSheetEntryCount
      '2025' + // ifrsImplementationYear
      '1' + // ifrsReportingOption
      '12345678' + // softwareRegistrationNumber
      '005' + // partnershipCount
      '001000' + // partnershipProfitShare
      '01' + // currencyType
      '01' + // auditOpinionType
      '1' + // amountsInThousands
      // Pad to ensure sufficient length
      '                                                                                           ';

    const result = parseHeaderRecord(validHeaderLine);

    // Assert the parsed values
    expect(result.taxFileNumber).toBe('123456789');
    expect(result.taxYear).toBe('2025');
    expect(result.idNumber).toBe('987654321');
    expect(result.vatFileNumber).toBe('123456789');
    expect(result.withholdingTaxFileNumber).toBe('987654321');
    expect(result.industryCode).toBe('1234');
    expect(result.businessDescription).toBe('Tech Company');
    expect(result.businessType).toBe(BusinessType.INDUSTRIAL);
    expect(result.reportingMethod).toBe(ReportingMethod.CASH);
    expect(result.accountingMethod).toBe(AccountingMethod.SINGLE_ENTRY);
    expect(result.accountingSystem).toBe(AccountingSystem.MANUAL);
    expect(result.isPartnership).toBe(YesNo.YES);
    expect(result.includesProfitLoss).toBe(YesNo.YES);
    expect(result.includesTaxAdjustment).toBe(YesNo.YES);
    expect(result.includesBalanceSheet).toBe(YesNo.YES);
    expect(result.profitLossEntryCount).toBe(10);
    expect(result.taxAdjustmentEntryCount).toBe(20);
    expect(result.balanceSheetEntryCount).toBe(30);
    expect(result.ifrsImplementationYear).toBe('2025');
    expect(result.softwareRegistrationNumber).toBe('12345678');
    expect(result.partnershipCount).toBe(5);
    expect(result.partnershipProfitShare).toBe(1000);
    expect(result.currencyType).toBe(CurrencyType.SHEKELS);
    expect(result.amountsInThousands).toBe(YesNo.YES);
  });

  // Test for minimum valid header line
  it('should correctly parse a header line with minimum required fields', () => {
    // Create a sample header with just the minimum required fields
    const minimalHeaderLine =
      '123456789' + // taxFileNumber
      '2025' + // taxYear
      '987654321' + // idNumber
      '         ' + // vatFileNumber (empty)
      '         ' + // withholdingTaxFileNumber (empty)
      '1234' + // industryCode
      '                                                  ' + // businessDescription (empty)
      '01' + // businessType
      '01' + // reportingMethod
      '01' + // accountingMethod
      '01' + // accountingSystem
      ' ' + // isPartnership (empty)
      '1' + // includesProfitLoss
      '1' + // includesTaxAdjustment
      '1' + // includesBalanceSheet
      '   ' + // profitLossEntryCount (empty)
      '   ' + // taxAdjustmentEntryCount (empty)
      '   ' + // balanceSheetEntryCount (empty)
      '    ' + // ifrsImplementationYear (empty)
      ' ' + // ifrsReportingOption (empty)
      '        ' + // softwareRegistrationNumber (empty)
      '   ' + // partnershipCount (empty)
      '      ' + // partnershipProfitShare (empty)
      '01' + // currencyType
      '  ' + // auditOpinionType (empty)
      '2' + // amountsInThousands
      // Pad to ensure sufficient length
      '                                                                                           ';

    const result = parseHeaderRecord(minimalHeaderLine);

    // Assert the parsed values
    expect(result.taxFileNumber).toBe('123456789');
    expect(result.taxYear).toBe('2025');
    expect(result.idNumber).toBe('987654321');
    expect(result.vatFileNumber).toBeUndefined();
    expect(result.withholdingTaxFileNumber).toBeUndefined();
    expect(result.industryCode).toBe('1234');
    expect(result.businessDescription).toBeUndefined();
    expect(result.businessType).toBe(BusinessType.INDUSTRIAL);
    expect(result.reportingMethod).toBe(ReportingMethod.CASH);
    expect(result.accountingMethod).toBe(AccountingMethod.SINGLE_ENTRY);
    expect(result.accountingSystem).toBe(AccountingSystem.MANUAL);
    expect(result.isPartnership).toBeUndefined();
    expect(result.includesProfitLoss).toBe(YesNo.YES);
    expect(result.includesTaxAdjustment).toBe(YesNo.YES);
    expect(result.includesBalanceSheet).toBe(YesNo.YES);
    expect(result.profitLossEntryCount).toBeUndefined();
    expect(result.taxAdjustmentEntryCount).toBeUndefined();
    expect(result.balanceSheetEntryCount).toBeUndefined();
    expect(result.ifrsImplementationYear).toBeUndefined();
    expect(result.ifrsReportingOption).toBeUndefined();
    expect(result.softwareRegistrationNumber).toBeUndefined();
    expect(result.partnershipCount).toBeUndefined();
    expect(result.partnershipProfitShare).toBeUndefined();
    expect(result.currencyType).toBe(CurrencyType.SHEKELS);
    expect(result.auditOpinionType).toBeUndefined();
    expect(result.amountsInThousands).toBe(YesNo.NO);
  });

  // Test for invalid header line (too short)
  it('should throw an error for a header line that is too short', () => {
    const shortHeaderLine = '12345678920259876';
    expect(() => parseHeaderRecord(shortHeaderLine)).toThrow(
      'Invalid header line: Insufficient data',
    );
  });

  // Test for invalid header line (empty)
  it('should throw an error for an empty header line', () => {
    expect(() => parseHeaderRecord('')).toThrow('Invalid header line: Insufficient data');
  });

  // Test for invalid header line (null)
  it('should throw an error for a null header line', () => {
    expect(() => parseHeaderRecord(null as unknown as string)).toThrow(
      'Invalid header line: Insufficient data',
    );
  });

  // Test for handling of non-numeric fields
  it('should handle non-numeric fields in the header line', () => {
    // Create a sample header with non-numeric fields where numbers are expected
    const nonNumericHeaderLine =
      '123456789' + // taxFileNumber
      '2025' + // taxYear
      '987654321' + // idNumber
      '         ' + // vatFileNumber (empty)
      '         ' + // withholdingTaxFileNumber (empty)
      '1234' + // industryCode
      '                                                  ' + // businessDescription (empty)
      ' A' + // businessType (non-numeric)
      ' B' + // reportingMethod (non-numeric)
      ' C' + // accountingMethod (non-numeric)
      ' D' + // accountingSystem (non-numeric)
      ' ' + // isPartnership (empty)
      'X' + // includesProfitLoss (non-numeric)
      'Y' + // includesTaxAdjustment (non-numeric)
      'Z' + // includesBalanceSheet (non-numeric)
      'ABC' + // profitLossEntryCount (non-numeric)
      'DEF' + // taxAdjustmentEntryCount (non-numeric)
      'GHI' + // balanceSheetEntryCount (non-numeric)
      '    ' + // ifrsImplementationYear (empty)
      ' ' + // ifrsReportingOption (empty)
      '        ' + // softwareRegistrationNumber (empty)
      '   ' + // partnershipCount (empty)
      '      ' + // partnershipProfitShare (empty)
      ' ' + // currencyType (non-numeric)
      ' ' + // auditOpinionType (empty)
      ' ' + // amountsInThousands (non-numeric)
      // Pad to ensure sufficient length
      '                                                                                           ';

    const result = parseHeaderRecord(nonNumericHeaderLine);

    // Assert the parsed values (non-numeric values should be parsed as 0 or default values)
    expect(result.businessType).toBe(0);
    expect(result.reportingMethod).toBe(0);
    expect(result.accountingMethod).toBe(0);
    expect(result.accountingSystem).toBe(0);
    expect(result.includesProfitLoss).toBe(0);
    expect(result.includesTaxAdjustment).toBe(0);
    expect(result.includesBalanceSheet).toBe(0);
    expect(result.profitLossEntryCount).toBe(undefined);
    expect(result.taxAdjustmentEntryCount).toBe(undefined);
    expect(result.balanceSheetEntryCount).toBe(undefined);
    expect(result.currencyType).toBe(0); // Default value
    expect(result.amountsInThousands).toBe(YesNo.NO); // Default value
  });
});
