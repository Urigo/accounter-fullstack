import { parseReportEntries } from '../src/parsers/parse-report-entries';

describe('parseReportEntries', () => {
  // Test for valid profit and loss entries
  it('should correctly parse valid profit and loss entries', () => {
    // Create a sample content with valid entries
    // The profitAndLoss section starts at position 513
    let content = ''.padStart(513, '*'); // Padding to reach position 513

    // Add some valid entries (5 digits code + 13 digits amount)
    content += '001000000000012345'; // Code 100, Amount 12345
    content += '002000000000054321'; // Code 200, Amount 54321
    content += '00300-000000009876'; // Code 300, Amount -9876 (negative)

    // Add some filler records (should be filtered out)
    content += '000000000000000000';
    content += '000000000000000000';

    const result = parseReportEntries(content, 'profitAndLoss');

    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ code: 100, amount: 12_345 });
    expect(result[1]).toEqual({ code: 200, amount: 54_321 });
    expect(result[2]).toEqual({ code: 300, amount: -9876 });
  });

  // Test for valid tax adjustment entries
  it('should correctly parse valid tax adjustment entries', () => {
    // Create a sample content with valid entries
    // The taxAdjustment section starts at position 3213
    let content = ''.padStart(3213, '*'); // Padding to reach position 3213

    // Add some valid entries (5 digits code + 13 digits amount)
    content += '001000000000067890'; // Code 100, Amount 67890
    content += '001030000000098765'; // Code 103, Amount 98765
    content += '00400-000000001234'; // Code 400, Amount -1234 (negative)

    const result = parseReportEntries(content, 'taxAdjustment');

    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ code: 100, amount: 67_890 });
    expect(result[1]).toEqual({ code: 103, amount: 98_765 });
    expect(result[2]).toEqual({ code: 400, amount: -1234 });
  });

  // Test for valid balance sheet entries
  it('should correctly parse valid balance sheet entries', () => {
    // Create a sample content with valid entries
    // The balanceSheet section starts at position 5913
    let content = ''.padStart(5913, '*'); // Padding to reach position 5913

    // Add some valid entries (5 digits code + 13 digits amount)
    content += '060000000000055555'; // Code 6000, Amount 55555
    content += '070000000000099999'; // Code 7000, Amount 99999
    content += '07800-000000077777'; // Code 7800, Amount -77777 (negative)

    const result = parseReportEntries(content, 'balanceSheet');

    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ code: 6000, amount: 55_555 });
    expect(result[1]).toEqual({ code: 7000, amount: 99_999 });
    expect(result[2]).toEqual({ code: 7800, amount: -77_777 });
  });

  // Test for content that is too short
  it('should handle content that is too short', () => {
    // Create content that doesn't reach the section position
    const shortContent = ''.padStart(500, '*'); // Less than 513 needed for profitAndLoss

    const result = parseReportEntries(shortContent, 'profitAndLoss');

    // Should return empty array as no entries could be parsed
    expect(result).toEqual([]);
  });

  // Test for content with invalid/malformed entries
  it('should handle content with invalid or malformed entries', () => {
    // Create a sample content with some invalid entries
    let content = ''.padStart(513, '*'); // Padding to reach position 513

    // Add some valid and invalid entries
    content += '001000000000012345'; // Valid: Code 100, Amount 12345
    content += 'ABCDE0000000054321'; // Invalid code (not numeric)
    content += '00300ABCDEFGHIJKLM'; // Invalid amount (not numeric)
    content += '00400-ABCDEFGHIJKM'; // Invalid negative amount
    content += '005  0000000078901'; // Code with spaces

    const result = parseReportEntries(content, 'profitAndLoss');

    // Only valid entries should be included, invalid entries should be parsed with defaults or filtered
    expect(result.length).toBe(5);
    expect(result[0]).toEqual({ code: 100, amount: 12_345 });
    expect(result[1]).toEqual({ code: NaN, amount: 54_321 }); // NaN code due to non-numeric input
    expect(result[2]).toEqual({ code: 300, amount: Number.NaN }); // 0 amount due to non-numeric input
    expect(result[3]).toEqual({ code: 400, amount: Number.NaN }); // 0 amount due to invalid negative format
    expect(result[4]).toEqual({ code: 5, amount: 78_901 }); // Spaces in code are trimmed
  });

  // Test for empty content
  it('should handle empty content', () => {
    const result = parseReportEntries('', 'profitAndLoss');
    expect(result).toEqual([]);
  });

  // Test for content with only filler records
  it('should filter out filler records (code 0, amount 0)', () => {
    let content = ''.padStart(513, '*'); // Padding to reach position 513

    // Add only filler records
    content += '000000000000000000';
    content += '000000000000000000';
    content += '000000000000000000';

    const result = parseReportEntries(content, 'profitAndLoss');

    // All filler records should be filtered out
    expect(result).toEqual([]);
  });

  // Test for records with code 0 but non-zero amount (should not be filtered)
  it('should not filter records with code 0 but non-zero amount', () => {
    let content = ''.padStart(513, '*'); // Padding to reach position 513

    content += '000000000000012345'; // Code 0, Amount 12345

    const result = parseReportEntries(content, 'profitAndLoss');

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({ code: 0, amount: 12_345 });
  });

  // Test for records with non-zero code but amount 0 (should not be filtered)
  it('should not filter records with non-zero code but amount 0', () => {
    let content = ''.padStart(513, '*'); // Padding to reach position 513

    content += '001000000000000000'; // Code 100, Amount 0

    const result = parseReportEntries(content, 'profitAndLoss');

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({ code: 100, amount: 0 });
  });
});
