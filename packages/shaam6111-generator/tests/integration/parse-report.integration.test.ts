import { parseReport } from '../../src/parsers';
import { IndividualOrCompanyEnum } from '../../src/types';

describe('Integration Test: parseReport', () => {
  it('should correctly parse a valid company report', () => {
    // Create a sample company report - header + profit/loss + tax adjustment + balance sheet
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
      '002' + // taxAdjustmentEntryCount
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

    // Tax Adjustment Section (2 entries)
    reportContent += '001000000000250000'; // Code 100, Amount 250000 (matches 6666 from profit/loss)
    reportContent += '004000000000300000'; // Code 400, Amount 300000

    // Fill remaining tax adjustment entries with filler records
    for (let i = 0; i < 148; i++) {
      reportContent += '000000000000000000';
    }

    // Balance Sheet Section (8 entries)
    reportContent += '070000000000100000'; // Code 7000, Amount 100000
    reportContent += '078000000000100000'; // Code 7800, Amount 100000
    reportContent += '078500000000100000'; // Code 7805, Amount 100000
    reportContent += '088880000000100000'; // Code 8888, Amount 100000
    reportContent += '090000000000100000'; // Code 9000, Amount 100000
    reportContent += '093600000000100000'; // Code 9360, Amount 100000
    reportContent += '094000000000100000'; // Code 9400, Amount 100000
    reportContent += '099990000000100000'; // Code 9999, Amount 100000

    // Fill remaining balance sheet entries with filler records
    for (let i = 0; i < 142; i++) {
      reportContent += '000000000000000000';
    }

    // Parse the report
    const result = parseReport(reportContent, false);

    // Verify header data
    expect(result.header.taxFileNumber).toBe('123456782');
    expect(result.header.taxYear).toBe('2025');
    expect(result.header.businessType).toBe(2);
    expect(result.header.includesBalanceSheet).toBe(1);

    // Verify profit and loss entries
    expect(result.profitAndLoss.length).toBe(8);
    expect(result.profitAndLoss[0].code).toBe(1000);
    expect(result.profitAndLoss[0].amount).toBe(100_000);
    expect(result.profitAndLoss[7].code).toBe(6666);
    expect(result.profitAndLoss[7].amount).toBe(250_000);

    // Verify tax adjustment entries
    expect(result.taxAdjustment.length).toBe(2);
    expect(result.taxAdjustment[0].code).toBe(100);
    expect(result.taxAdjustment[0].amount).toBe(250_000);
    expect(result.taxAdjustment[1].code).toBe(400);
    expect(result.taxAdjustment[1].amount).toBe(300_000);

    // Verify balance sheet entries
    expect(result.balanceSheet.length).toBe(8);
    expect(result.balanceSheet[0].code).toBe(7000);
    expect(result.balanceSheet[0].amount).toBe(100_000);
    expect(result.balanceSheet[1].code).toBe(7800);
    expect(result.balanceSheet[1].amount).toBe(100_000);
    expect(result.balanceSheet[6].code).toBe(9400);
    expect(result.balanceSheet[6].amount).toBe(100_000);

    // Verify individual or company classification
    expect(result.individualOrCompany).toBe(IndividualOrCompanyEnum.COMPANY);
  });

  it('should correctly parse a valid individual report', () => {
    // Create a sample individual report - header + profit/loss + tax adjustment
    let reportContent =
      // Header Section
      '123456782' + // taxFileNumber
      '2025' + // taxYear
      '987654324' + // idNumber
      '121212120' + // vatFileNumber
      '343434346' + // withholdingTaxFileNumber
      '1234' + // industryCode
      'Individual Business                               ' + // businessDescription
      '03' + // businessType (SERVICE)
      '01' + // reportingMethod (CASH)
      '01' + // accountingMethod (SINGLE_ENTRY)
      '01' + // accountingSystem (MANUAL)
      '2' + // isPartnership (NO)
      '1' + // includesProfitLoss (YES)
      '1' + // includesTaxAdjustment (YES)
      '2' + // includesBalanceSheet (NO for individual)
      '002' + // profitLossEntryCount
      '002' + // taxAdjustmentEntryCount
      '000' + // balanceSheetEntryCount
      '    ' + // ifrsImplementationYear
      ' ' + // ifrsReportingOption
      '12345678' + // softwareRegistrationNumber
      '000' + // partnershipCount
      '000000' + // partnershipProfitShare
      '01' + // currencyType (SHEKELS)
      '09' + // auditOpinionType (NONE)
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

    // Tax Adjustment Section (2 entries)
    reportContent += '001000000000250000'; // Code 100, Amount 250000 (matches 6666 from profit/loss)
    reportContent += '004000000000300000'; // Code 400, Amount 300000

    // Fill remaining tax adjustment entries with filler records
    for (let i = 0; i < 148; i++) {
      reportContent += '000000000000000000';
    }

    // No Balance Sheet Section for individual
    for (let i = 0; i < 150; i++) {
      reportContent += '000000000000000000';
    }

    // Parse the report
    const result = parseReport(reportContent, false);

    // Verify header data
    expect(result.header.taxFileNumber).toBe('123456782');
    expect(result.header.taxYear).toBe('2025');
    expect(result.header.businessType).toBe(3);
    expect(result.header.includesBalanceSheet).toBe(2);

    // Verify profit and loss entries
    expect(result.profitAndLoss.length).toBe(8);
    expect(result.profitAndLoss[0].code).toBe(1000);
    expect(result.profitAndLoss[0].amount).toBe(100_000);
    expect(result.profitAndLoss[7].code).toBe(6666);
    expect(result.profitAndLoss[7].amount).toBe(250_000);

    // Verify tax adjustment entries
    expect(result.taxAdjustment.length).toBe(2);
    expect(result.taxAdjustment[0].code).toBe(100);
    expect(result.taxAdjustment[0].amount).toBe(250_000);
    expect(result.taxAdjustment[1].code).toBe(400);
    expect(result.taxAdjustment[1].amount).toBe(300_000);

    // Verify balance sheet entries (empty for individual)
    expect(result.balanceSheet.length).toBe(0);

    // Verify individual or company classification
    expect(result.individualOrCompany).toBe(IndividualOrCompanyEnum.INDIVIDUAL);
  });

  it('should handle reports with negative amounts', () => {
    // Create a sample report with negative amounts
    let reportContent =
      // Header Section (simplified)
      '12345678220259876543241212121203434343461234Company Ltd                                       020201021112009002002    91234567800000000001022';

    // Pad to reach position 512 where profit/loss section starts
    reportContent = reportContent.padEnd(512, '0');

    // Profit and Loss Section (9 entries)
    reportContent += '010000000000100000'; // Code 1000, Amount 100000
    reportContent += '010100000000110000'; // Code 1010, Amount 110000
    reportContent += '01090-000000010000'; // Code 1090, Amount 10000
    reportContent += '030000000000050000'; // Code 3000, Amount 50000
    reportContent += '030130000000050000'; // Code 3013, Amount 50000
    reportContent += '050000000000200000'; // Code 5000, Amount 200000
    reportContent += '050510000000150000'; // Code 5051, Amount 150000
    reportContent += '050900000000050000'; // Code 5090, Amount 50000
    reportContent += '066660000000250000'; // Code 6666, Amount 250000

    // Fill remaining profit/loss entries with filler records
    for (let i = 0; i < 141; i++) {
      reportContent += '000000000000000000';
    }

    // Tax Adjustment Section with negative amount
    reportContent += '001000000000125000'; // Code 100, Amount 125000
    reportContent += '00400-000000150000'; // Code 400, Amount -150000

    // Fill remaining tax adjustment entries with filler records
    for (let i = 0; i < 148; i++) {
      reportContent += '000000000000000000';
    }

    // Balance Sheet Section with negative amount
    reportContent += '06000-000000500000'; // Code 6000, Amount -500000
    reportContent += '078000000000100000'; // Code 7800, Amount 100000

    // Fill remaining balance sheet entries with filler records
    for (let i = 0; i < 148; i++) {
      reportContent += '000000000000000000';
    }

    // Parse the report
    const result = parseReport(reportContent, false);

    // Verify entries with negative amounts
    expect(result.profitAndLoss[0].code).toBe(1000);
    expect(result.profitAndLoss[0].amount).toBe(100_000);
    expect(result.profitAndLoss[2].code).toBe(1090);
    expect(result.profitAndLoss[2].amount).toBe(-10_000);

    expect(result.taxAdjustment[1].code).toBe(400);
    expect(result.taxAdjustment[1].amount).toBe(-150_000);

    expect(result.balanceSheet[0].code).toBe(6000);
    expect(result.balanceSheet[0].amount).toBe(-500_000);
  });

  it('should throw validation error for invalid report data', () => {
    // Create an invalid report with mismatched values between sections
    let reportContent =
      // Header Section
      '123456789202598765432112345678998765432112341234Company Ltd                                       221121112002002002    912345678000000000122';

    // Pad to reach position 512 where profit/loss section starts
    reportContent = reportContent.padEnd(512, '0');

    // Profit and Loss Section
    reportContent += '66660000000250000'; // Code 6666, Amount 250000

    // Fill remaining profit/loss entries with filler records
    for (let i = 0; i < 149; i++) {
      reportContent += '00000000000000000';
    }

    // Tax Adjustment Section with MISMATCHED value (should match code 6666 from profit/loss)
    reportContent += '01000000000300000'; // Code 100, Amount 300000 (MISMATCH)
    reportContent += '04000000000300000'; // Code 400, Amount 300000

    // Fill remaining tax adjustment entries with filler records
    for (let i = 0; i < 148; i++) {
      reportContent += '00000000000000000';
    }

    // Balance Sheet Section
    reportContent += '60000000000500000'; // Code 6000, Amount 500000
    reportContent += '78000000000100000'; // Code 7800, Amount 100000

    // Fill remaining balance sheet entries with filler records
    for (let i = 0; i < 118; i++) {
      reportContent += '00000000000000000';
    }

    // Expect validation error due to mismatch between code 6666 and code 100
    expect(() => parseReport(reportContent)).toThrow(/Validation failed/);
  });
});
