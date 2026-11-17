import { describe, expect, it } from 'vitest';
import {
  encodeReportFile,
  END_OF_FILE_MARKER,
  frameReportFile,
  RECORD_TERMINATOR,
} from '../src/generators/generate-report-file.js';
import { generateReport } from '../src/generators/generate-report.js';
import { parseReport } from '../src/parsers/parse-report.js';
import { validReportData1 } from './fixtures/validDataSets/data1.js';

describe('frameReportFile', () => {
  it('ends every record with CR LF and the file with X0D0A1A', () => {
    const record = generateReport(validReportData1, false);
    const content = frameReportFile(record);

    expect(content).toHaveLength(8612 + 3);
    expect(content.slice(0, 8612)).toBe(record);
    expect(content.slice(8612)).toBe(RECORD_TERMINATOR + END_OF_FILE_MARKER);
    expect(content.endsWith('\r\n\x1a')).toBe(true);
  });

  it('frames several records, each followed by CR LF', () => {
    const record = generateReport(validReportData1, false);
    const content = frameReportFile([record, record]);

    expect(content).toBe(`${record}\r\n${record}\r\n\x1a`);
  });

  it('rejects an empty file and more than 10 reports', () => {
    const record = generateReport(validReportData1, false);
    expect(() => frameReportFile([])).toThrow();
    expect(() => frameReportFile(Array.from({ length: 11 }, () => record))).toThrow();
  });

  it('can still be parsed back after framing', () => {
    const record = generateReport(validReportData1, false);
    const parsed = parseReport(frameReportFile(record), false);
    expect(parsed.header.taxYear).toBe(validReportData1.header.taxYear);
    expect(parsed.profitAndLoss).toEqual(validReportData1.profitAndLoss);
  });
});

describe('encodeReportFile', () => {
  it('encodes Hebrew as single-byte Windows-1255', () => {
    const record = generateReport(
      {
        ...validReportData1,
        header: { ...validReportData1.header, businessDescription: 'פיתוח תוכנה' },
      },
      false,
    );
    const bytes = encodeReportFile(record);

    // Windows-1255 is single-byte, so the byte length equals the character length
    expect(bytes).toHaveLength(8612 + 3);
    expect(Array.from(bytes.slice(-3))).toEqual([0x0d, 0x0a, 0x1a]);
    // 'פ' is 0xF4 and 'ת' is 0xFA in Windows-1255; UTF-8 would have emitted 0xD7 lead bytes
    expect(bytes.includes(0xf4)).toBe(true);
    expect(bytes.includes(0xfa)).toBe(true);
    expect(bytes.includes(0xd7)).toBe(false);
  });
});
