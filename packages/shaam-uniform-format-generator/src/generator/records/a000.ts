import { z } from 'zod';
import { SHAAM_VERSION } from '../../constants.js';
import { CRLF } from '../../format/index.js';
import { formatField, formatNumericField } from '../format/encoder.js';

/**
 * A000 Record Schema - File header record for INI.TXT
 * This record appears in the INI.TXT file and provides metadata about the data file
 */
export const A000Schema = z.object({
  // Record code (4) - Required - Alphanumeric
  code: z.literal('A000').describe('Record type code - always "A000"'),
  // Record number in file (9) - Required - Numeric
  recordNumber: z
    .string()
    .min(1)
    .max(9)
    .regex(/^\d+$/)
    .describe('Sequential record number in INI file'),
  // Tax ID (9) - Required - Numeric
  vatId: z.string().min(1).max(9).regex(/^\d+$/).describe('VAT identification number'),
  // Data file name (50) - Required - Alphanumeric
  dataFileName: z.string().min(1).max(50).describe('Name of the corresponding BKMVDATA.TXT file'),
  // Report period start date (8) - Required - Numeric YYYYMMDD
  reportPeriodStart: z
    .string()
    .length(8)
    .regex(/^\d{8}$/)
    .describe('Report period start date YYYYMMDD'),
  // Report period end date (8) - Required - Numeric YYYYMMDD
  reportPeriodEnd: z
    .string()
    .length(8)
    .regex(/^\d{8}$/)
    .describe('Report period end date YYYYMMDD'),
  // System constant (8) - Required - Alphanumeric - Value: &OF1.31&
  systemConstant: z
    .literal(SHAAM_VERSION)
    .optional()
    .describe(`System constant - always "${SHAAM_VERSION}"`),
  // Reserved field (50) - Optional - Alphanumeric
  reserved: z.string().max(50).default('').describe('Reserved field for future use'),
});

export type A000 = z.infer<typeof A000Schema>;

/**
 * Encodes an A000 record to fixed-width string format
 * Total line width: 136 characters + CRLF
 */
export function encodeA000(input: A000): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Record code (4) - Alphanumeric
    formatNumericField(input.recordNumber, 9), // Record number (9) - Numeric, zero-padded
    formatNumericField(input.vatId, 9), // VAT ID (9) - Numeric, zero-padded
    formatField(input.dataFileName, 50, 'left'), // Data file name (50) - Alphanumeric
    formatNumericField(input.reportPeriodStart, 8), // Report period start (8) - Numeric
    formatNumericField(input.reportPeriodEnd, 8), // Report period end (8) - Numeric
    formatField(SHAAM_VERSION, 8, 'left'), // System constant (8) - Alphanumeric
    formatField(input.reserved, 50, 'left'), // Reserved (50) - Alphanumeric
  ];

  return fields.join('') + CRLF;
}

/**
 * Parses a fixed-width A000 record line back to object
 * Expected line length: 136 characters (excluding CRLF)
 */
export function parseA000(line: string): A000 {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 136) {
    throw new Error(`Invalid A000 record length: expected 136 characters, got ${cleanLine.length}`);
  }

  // Extract fields at their fixed positions
  const code = cleanLine.slice(0, 4).trim();
  const recordNumber = cleanLine.slice(4, 13).trim().replace(/^0+/, '') || '0'; // Strip leading zeros
  const vatId = cleanLine.slice(13, 22).trim().replace(/^0+/, '') || '0'; // Strip leading zeros
  const dataFileName = cleanLine.slice(22, 72).trim();
  const reportPeriodStart = cleanLine.slice(72, 80).trim();
  const reportPeriodEnd = cleanLine.slice(80, 88).trim();
  const systemConstant = cleanLine.slice(88, 96).trim();
  const reserved = cleanLine.slice(96, 146).trim();

  // Validate the code field
  if (code !== 'A000') {
    throw new Error(`Invalid A000 record code: expected "A000", got "${code}"`);
  }

  // Validate the system constant field
  if (systemConstant !== SHAAM_VERSION) {
    throw new Error(
      `Invalid system constant: expected "${SHAAM_VERSION}", got "${systemConstant}"`,
    );
  }

  const parsed: A000 = {
    code,
    recordNumber,
    vatId,
    dataFileName,
    reportPeriodStart,
    reportPeriodEnd,
    systemConstant: SHAAM_VERSION,
    reserved,
  };

  // Validate against schema
  return A000Schema.parse(parsed);
}
