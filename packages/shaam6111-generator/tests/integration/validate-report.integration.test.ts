import { validateReport } from '../../src';

describe('Integration Test: validateReport', () => {
  it('should validate a valid company report', () => {
    // Create a sample valid company report
    let reportContent =
      // Header Section
      '123456782' + // taxFileNumber
      '2025' + // taxYear
      '987654324' + // idNumber
      '121212120' + // vatFileNumber
      '343434346' + // withholdingTaxFileNumber
      '1234' + // industryCode
      'Sample Company Ltd                                ' + // businessDescription
      '02' + // businessType (COMMERCIAL)
      '02' + // reportingMethod (ACCRUAL)
      '02' + // accountingMethod (DOUBLE_ENTRY)
      '02' + // accountingSystem (COMPUTERIZED)
      '2' + // isPartnership (NO)
      '1' + // includesProfitLoss (YES)
      '1' + // includesTaxAdjustment (YES)
      '1' + // includesBalanceSheet (YES)
      '008' + // profitLossEntryCount
      '003' + // taxAdjustmentEntryCount
      '008' + // balanceSheetEntryCount
      '2023' + // ifrsImplementationYear
      '9' + // ifrsReportingOption (NONE)
      '12345678' + // softwareRegistrationNumber
      '000' + // partnershipCount
      '000000' + // partnershipProfitShare
      '01' + // currencyType (SHEKELS)
      '01' + // auditOpinionType (UNQUALIFIED)
      '2'; // amountsInThousands (NO)

    // Pad to reach position 512 where profit/loss section starts
    reportContent = reportContent.padEnd(512, '0');

    // Profit and Loss Section (8 entries)
    reportContent += '010000000000100000'; // Code 1000, Amount 100000
    reportContent += '010100000000100000'; // Code 1010, Amount 100000
    reportContent += '030000000000050000'; // Code 3000, Amount 50000
    reportContent += '030130000000050000'; // Code 3013, Amount 50000
    reportContent += '050000000000200000'; // Code 5000, Amount 200000
    reportContent += '050510000000150000'; // Code 5051, Amount 150000
    reportContent += '050900000000050000'; // Code 5090, Amount 50000
    reportContent += '066660000000250000'; // Code 6666, Amount 250000

    // Fill remaining profit/loss entries with filler records
    for (let i = 0; i < 142; i++) {
      reportContent += '000000000000000000';
    }

    // Tax Adjustment Section (3 entries)
    reportContent += '001000000000250000'; // Code 100, Amount 250000 (matches 6666 from profit/loss)
    reportContent += '001040000000250000'; // Code 104, Amount 250000
    reportContent += '004000000000300000'; // Code 400, Amount 300000

    // Fill remaining tax adjustment entries with filler records
    for (let i = 0; i < 147; i++) {
      reportContent += '000000000000000000';
    }

    // Balance Sheet Section (8 entries)
    reportContent += '070000000000100000'; // Code 7000, Amount 100000
    reportContent += '071000000000100000'; // Code 7100, Amount 100000
    reportContent += '071100000000100000'; // Code 7110, Amount 100000
    reportContent += '088880000000100000'; // Code 8888, Amount 100000
    reportContent += '090000000000100000'; // Code 9000, Amount 100000
    reportContent += '093600000000100000'; // Code 9360, Amount 100000
    reportContent += '094000000000100000'; // Code 9400, Amount 100000
    reportContent += '099990000000100000'; // Code 9999, Amount 100000

    // Fill remaining balance sheet entries with filler records
    for (let i = 0; i < 142; i++) {
      reportContent += '000000000000000000';
    }

    const result = validateReport(reportContent);
    expect(result.isValid).toBe(true);
    expect(result.errors?.length).toBe(0);
  });

  it('should detect invalid report with mismatched code amounts', () => {
    // Create a report with mismatched values between code 6666 and code 100
    let reportContent =
      // Header Section (simplified)
      '12345678220259876543241212121203434343461234Company Ltd                                       030101012112002002000     1234567800000000001092';

    // Pad to reach position 512 where profit/loss section starts
    reportContent = reportContent.padEnd(512, '0');

    // Profit and Loss Section (8 entries)
    reportContent += '010000000000100000'; // Code 1000, Amount 100000
    reportContent += '010100000000100000'; // Code 1010, Amount 100000
    reportContent += '030000000000050000'; // Code 3000, Amount 50000
    reportContent += '030130000000050000'; // Code 3013, Amount 50000
    reportContent += '050000000000200000'; // Code 5000, Amount 200000
    reportContent += '050510000000150000'; // Code 5051, Amount 150000
    reportContent += '050900000000050000'; // Code 5090, Amount 50000
    reportContent += '066660000000250000'; // Code 6666, Amount 250000

    // Fill remaining profit/loss entries with filler records
    for (let i = 0; i < 142; i++) {
      reportContent += '000000000000000000';
    }

    // Tax Adjustment Section (2 entries)
    reportContent += '001000000000200000'; // Code 100, Amount 200000 (matches 6666 from profit/loss)
    reportContent += '004000000000300000'; // Code 400, Amount 300000

    // Fill remaining tax adjustment entries with filler records
    for (let i = 0; i < 148; i++) {
      reportContent += '000000000000000000';
    }

    // No Balance Sheet Section for individual
    for (let i = 0; i < 150; i++) {
      reportContent += '000000000000000000';
    }

    const result = validateReport(reportContent);

    expect(result.isValid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
    // Check if the error is related to the mismatch
    expect(
      result.errors?.some(
        err =>
          err.message.includes('6666') &&
          err.message.includes('100') &&
          err.message.includes('equal'),
      ),
    ).toBe(true);
  });

  it('should detect invalid report with missing balance sheet for company', () => {
    // Create a company report without balance sheet entries
    let reportContent =
      // Header Section with includesBalanceSheet=1 (YES)
      '12345678220259876543241212121203434343461234Company Ltd                                       020201012111008003000    91234567800000000001022';

    // Pad to reach position 512 where profit/loss section starts
    reportContent = reportContent.padEnd(512, '0');

    // Profit and Loss Section (8 entries)
    reportContent += '010000000000100000'; // Code 1000, Amount 100000
    reportContent += '010100000000100000'; // Code 1010, Amount 100000
    reportContent += '030000000000050000'; // Code 3000, Amount 50000
    reportContent += '030130000000050000'; // Code 3013, Amount 50000
    reportContent += '050000000000200000'; // Code 5000, Amount 200000
    reportContent += '050510000000150000'; // Code 5051, Amount 150000
    reportContent += '050900000000050000'; // Code 5090, Amount 50000
    reportContent += '066660000000250000'; // Code 6666, Amount 250000

    // Fill remaining profit/loss entries with filler records
    for (let i = 0; i < 142; i++) {
      reportContent += '000000000000000000';
    }

    // Tax Adjustment Section (3 entries)
    reportContent += '001000000000250000'; // Code 100, Amount 250000 (matches 6666 from profit/loss)
    reportContent += '001040000000250000'; // Code 104, Amount 250000
    reportContent += '004000000000300000'; // Code 400, Amount 300000

    // Fill remaining tax adjustment entries with filler records
    for (let i = 0; i < 147; i++) {
      reportContent += '000000000000000000';
    }

    // No Balance Sheet entries despite being a company and including balance sheet in header
    for (let i = 0; i < 150; i++) {
      reportContent += '000000000000000000';
    }

    const result = validateReport(reportContent);
    expect(result.isValid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
    // Check if the error is related to missing balance sheet
    expect(
      result.errors?.some(
        err => err.message.includes('Balance Sheet') || err.path?.includes('balanceSheet'), // TODO: remove path check after enhancing individual/company validation
      ),
    ).toBe(true);
  });

  it('should detect report with invalid header fields', () => {
    // Create a report with invalid header fields
    let reportContent =
      // Invalid Header Section (tax file number too short, tax year too short)
      '12345' + // taxFileNumber (invalid - too short)
      '202' + // taxYear (invalid - too short)
      '987654324' + // idNumber
      '121212120' + // vatFileNumber
      '343434346' + // withholdingTaxFileNumber
      '1234' + // industryCode
      'Sample Company Ltd                                ' + // businessDescription
      '02' + // businessType
      '02' + // reportingMethod
      '02' + // accountingMethod
      '02' + // accountingSystem
      '2' + // isPartnership
      '1' + // includesProfitLoss
      '1' + // includesTaxAdjustment
      '1' + // includesBalanceSheet
      '002' + // profitLossEntryCount
      '002' + // taxAdjustmentEntryCount
      '002' + // balanceSheetEntryCount
      '2023' + // ifrsImplementationYear
      '9' + // ifrsReportingOption (NONE)
      '12345678' + // softwareRegistrationNumber
      '000' + // partnershipCount
      '000000' + // partnershipProfitShare
      '01' + // currencyType
      '01' + // auditOpinionType
      '2'; // amountsInThousands

    // Pad to reach position 512
    reportContent = reportContent.padEnd(512, '0');

    // Add minimal sections to complete the report
    // Profit and Loss Section
    reportContent += '010010000000100000';
    // Fill remaining with zeros
    reportContent = reportContent.padEnd(512 + 150 * 18, '0');

    // Tax Adjustment Section
    reportContent += '001000000000100000';
    // Fill remaining with zeros
    reportContent = reportContent.padEnd(512 + 150 * 18 + 150 * 18, '0');

    // Balance Sheet Section
    reportContent += '060000000000100000';
    // Fill remaining with zeros
    reportContent = reportContent.padEnd(512 + 150 * 18 + 150 * 18 + 150 * 18, '0');

    const result = validateReport(reportContent);
    expect(result.isValid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
    // Check if the errors include the invalid header fields
    expect(
      result.errors?.some(
        err => err.path?.includes('taxFileNumber') || err.path?.includes('taxYear'),
      ),
    ).toBe(true);
  });

  it('should detect malformed report with truncated content', () => {
    // Create a truncated report (too short)
    const truncatedReport = '123456789202598765432112345678998765432112341234Company Ltd';

    const result = validateReport(truncatedReport);
    expect(result.isValid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
    // Check for appropriate error message
    expect(result.errors?.some(err => err.message.includes('incorrect length'))).toBe(true);
  });

  it('should detect malformed report with invalid data types', () => {
    // Create a report with invalid data types in the header
    let reportContent =
      // Header with invalid data types (letters where numbers expected)
      '123456782' + // taxFileNumber
      '2025' + // taxYear
      '987654324' + // idNumber
      '121212120' + // vatFileNumber
      '343434346' + // withholdingTaxFileNumber
      'ABCD' + // industryCode (invalid - should be numbers)
      'Sample Company Ltd                                ' + // businessDescription
      '0X' + // businessType (invalid - should be number)
      '0Y' + // reportingMethod (invalid - should be number)
      '0Z' + // accountingMethod (invalid - should be number)
      '0W' + // accountingSystem (invalid - should be number)
      'V' + // isPartnership (invalid - should be number)
      'U' + // includesProfitLoss (invalid - should be number)
      'T' + // includesTaxAdjustment (invalid - should be number)
      'S' + // includesBalanceSheet (invalid - should be number)
      'ABC' + // profitLossEntryCount (invalid - should be number)
      'DEF' + // taxAdjustmentEntryCount (invalid - should be number)
      'GHI' + // balanceSheetEntryCount (invalid - should be number)
      'JKLM' + // ifrsImplementationYear (invalid format)
      'N' + // ifrsReportingOption (invalid - should be number)
      'OPQRSTUV' + // softwareRegistrationNumber (invalid format)
      'WXY' + // partnershipCount (invalid - should be number)
      'ZABCDE' + // partnershipProfitShare (invalid - should be number)
      '0F' + // currencyType (invalid - should be number)
      '0G' + // auditOpinionType (invalid - should be number)
      'H'; // amountsInThousands (invalid - should be number)

    // Pad to reach position 512
    reportContent = reportContent.padEnd(512, '0');

    // Add minimal sections to complete the report
    // Profit and Loss Section
    reportContent += '010010000000100000';
    // Fill remaining with zeros
    reportContent = reportContent.padEnd(512 + 150 * 18, '0');

    // Tax Adjustment Section
    reportContent += '001000000000100000';
    // Fill remaining with zeros
    reportContent = reportContent.padEnd(512 + 150 * 18 + 150 * 18, '0');

    // Balance Sheet Section
    reportContent += '060000000000100000';
    // Fill remaining with zeros
    reportContent = reportContent.padEnd(512 + 150 * 18 + 150 * 18 + 150 * 18, '0');

    const result = validateReport(reportContent);
    expect(result.isValid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(
      result.errors?.some(err => err.message.includes('Invalid option: expected one of ')),
    ).toBe(true);
  });

  it('should handle empty report content', () => {
    const result = validateReport('');
    expect(result.isValid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.errors?.[0]?.message).toContain('incorrect length');
  });

  it('should handle null report content', () => {
    const result = validateReport(null as unknown as string);
    expect(result.isValid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });
});
