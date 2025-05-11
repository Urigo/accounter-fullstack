import { generateReportEntriesSection } from '../src/generators/report-entries';
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
    const phantomRecord = '00000000000000000';
    expect(result.length).toBe(2700);
    expect(result.endsWith(phantomRecord.repeat(149))).toBe(true);
  });
});
