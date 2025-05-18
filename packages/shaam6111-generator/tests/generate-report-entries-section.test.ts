import { generateReportEntriesSection } from '../src/generators/generate-report-entries';
import { ReportEntry } from '../src/types';

describe('generateReportEntriesSection', () => {
  it('should generate a string of the correct length', () => {
    const entries: ReportEntry[] = [
      { code: 12_345, amount: 123.45 },
      { code: 67_890, amount: 678.9 },
    ];

    const result = generateReportEntriesSection(entries);
    expect(result.length).toBe(2700);
  });

  it('should format fields correctly', () => {
    const entries: ReportEntry[] = [
      { code: 123, amount: 123.45 },
      { code: 6789, amount: 678.9 },
    ];

    const result = generateReportEntriesSection(entries);
    expect(result.startsWith('001230000000000123067890000000000679')).toBe(true);
  });

  it('should fill with phantom records if less than 150 entries', () => {
    const entries: ReportEntry[] = [{ code: 12_345, amount: 123.45 }];

    const result = generateReportEntriesSection(entries);
    const phantomRecord = '000000000000000000';
    const expectedFirstEntry = '123450000000000123';
    expect(result.length).toBe(2700);
    expect(result.startsWith(expectedFirstEntry)).toBe(true);
    expect(result.endsWith(phantomRecord.repeat(149))).toBe(true);
    // Check that the pattern is repeated exactly 149 times
    expect(result.substring(18).split(phantomRecord).length - 1).toBe(149);
  });

  it('should format negative amounts correctly', () => {
    const entries: ReportEntry[] = [{ code: 123, amount: -123.45 }];

    const result = generateReportEntriesSection(entries);
    expect(result.startsWith('00123-000000000123')).toBe(true);
  });

  it('should handle more than 150 entries by truncating', () => {
    // Create 151 entries
    const entries: ReportEntry[] = Array.from({ length: 151 }, (_, i) => ({
      code: 1000 + i,
      amount: 1000 + i,
    }));

    const result = generateReportEntriesSection(entries);
    expect(result.length).toBe(2700); // Should still be 2700 chars
    // Should only contain first 150 entries (150 * 18 = 2700)
    expect(result).not.toContain('01150'); // The 151st entry should be excluded
  });
});
