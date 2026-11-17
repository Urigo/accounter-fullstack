import { describe, expect, it } from 'vitest';
import {
  encodeReportFile,
  END_OF_FILE_MARKER,
  frameReportFile,
  RECORD_TERMINATOR,
} from '../src/generators/generate-report-file.js';
import { generateReport } from '../src/generators/generate-report.js';
import { parseReport } from '../src/parsers/parse-report.js';
import { convertReportToFile, readReportFromFile } from '../src/utils/file-utils.js';
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

  it('rejects a record that is not exactly 8612 characters', () => {
    const record = generateReport(validReportData1, false);
    expect(() => frameReportFile(record.slice(0, -1))).toThrow(/report 1 must be 8612/);
    expect(() => frameReportFile([record, `${record}0`])).toThrow(/report 2 must be 8612/);
    // an already-framed string must not be framed twice
    expect(() => frameReportFile(frameReportFile(record))).toThrow(/got 8615/);
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

describe('convertReportToFile / readReportFromFile', () => {
  it('writes a framed Windows-1255 file that reads back to the same report', async () => {
    const data = {
      ...validReportData1,
      header: { ...validReportData1.header, businessDescription: 'פיתוח תוכנה' },
    };
    const file = convertReportToFile(data, 'DKASPI.DAT', false);
    const bytes = new Uint8Array(await file.arrayBuffer());

    expect(file.name).toBe('DKASPI.DAT');
    expect(bytes).toHaveLength(8612 + 3);
    expect(Array.from(bytes.slice(-3))).toEqual([0x0d, 0x0a, 0x1a]);

    const parsed = await readReportFromFile(file, true, false);
    expect(parsed).toEqual(parseReport(generateReport(data, false), false));
    expect(typeof parsed !== 'string' && parsed.header.businessDescription).toBe('פיתוח תוכנה');
  });
});
