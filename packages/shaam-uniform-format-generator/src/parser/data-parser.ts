/**
 * BKMVDATA.TXT file parsing utilities
 */

import {
  parseA100,
  parseB100,
  parseB110,
  parseC100,
  parseD110,
  parseD120,
  parseM100,
  parseZ900,
} from '../generator/records/index.js';

export interface ParseError {
  lineNumber: number;
  recordType: string;
  message: string;
  line: string;
}

export interface UnknownRecord {
  lineNumber: number;
  recordType: string;
  line: string;
}

export interface ParsedDataRecords {
  a100: ReturnType<typeof parseA100> | null;
  b100: ReturnType<typeof parseB100>[];
  b110: ReturnType<typeof parseB110>[];
  c100: ReturnType<typeof parseC100>[];
  d110: ReturnType<typeof parseD110>[];
  d120: ReturnType<typeof parseD120>[];
  m100: ReturnType<typeof parseM100>[];
  z900: ReturnType<typeof parseZ900> | null;
}

export interface ParseDataFileResult {
  records: ParsedDataRecords;
  summary: {
    totalLines: number;
    parsedRecords: number;
    failedRecords: number;
    unknownRecords: number;
    perType: Record<string, number>;
  };
  errors: ParseError[];
  unknownRecords: UnknownRecord[];
}

/**
 * Parses BKMVDATA.TXT file content
 *
 * @param content - Raw BKMVDATA.TXT file content
 * @returns Parsed data structure
 */
export function parseDataFile(content: string): ParseDataFileResult {
  const lines = content
    .split(/\r?\n/)
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line.trim().length > 0);

  const records = {
    a100: null as ReturnType<typeof parseA100> | null,
    b100: [] as ReturnType<typeof parseB100>[],
    b110: [] as ReturnType<typeof parseB110>[],
    c100: [] as ReturnType<typeof parseC100>[],
    d110: [] as ReturnType<typeof parseD110>[],
    d120: [] as ReturnType<typeof parseD120>[],
    m100: [] as ReturnType<typeof parseM100>[],
    z900: null as ReturnType<typeof parseZ900> | null,
  };

  const recordCounts: Record<string, number> = {};
  const errors: ParseError[] = [];
  const unknownRecords: UnknownRecord[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.length < 4) continue;

    const lineNumber = index + 1;
    const recordType = line.slice(0, 4);

    try {
      switch (recordType) {
        case 'A100':
          records.a100 = parseA100(line);
          break;
        case 'B100':
          records.b100.push(parseB100(line));
          break;
        case 'B110':
          records.b110.push(parseB110(line));
          break;
        case 'C100':
          records.c100.push(parseC100(line));
          break;
        case 'D110':
          records.d110.push(parseD110(line));
          break;
        case 'D120':
          records.d120.push(parseD120(line));
          break;
        case 'M100':
          records.m100.push(parseM100(line));
          break;
        case 'Z900':
          records.z900 = parseZ900(line);
          break;
        default:
          unknownRecords.push({
            lineNumber,
            recordType,
            line,
          });
          continue;
      }

      recordCounts[recordType] = (recordCounts[recordType] || 0) + 1;
    } catch (error) {
      errors.push({
        lineNumber,
        recordType,
        message: error instanceof Error ? error.message : 'Unknown parse error',
        line,
      });
    }
  }

  return {
    records,
    summary: {
      totalLines: lines.length,
      parsedRecords: Object.values(recordCounts).reduce((sum, count) => sum + count, 0),
      failedRecords: errors.length,
      unknownRecords: unknownRecords.length,
      perType: recordCounts,
    },
    errors,
    unknownRecords,
  };
}
