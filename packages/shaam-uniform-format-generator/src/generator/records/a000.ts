import { z } from 'zod';
import { SHAAM_VERSION } from '../../constants.js';
import { CRLF } from '../../format/index.js';
import { defaultKeyGenerator } from '../../utils/key-generator.js';
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
  // Field 1004: Primary identifier (15) - Required - Numeric
  primaryIdentifier: z
    .string()
    .min(1)
    .max(15)
    .regex(/^\d+$/)
    .describe('Fixed and unique primary identifier per file - see Note 2'),
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

/**
 * A000 Input Schema - for user input (excludes auto-generated fields)
 * Field 1004 (primaryIdentifier) is automatically generated
 */
export const A000InputSchema = A000Schema.omit({
  primaryIdentifier: true,
  code: true,
  systemConstant: true,
});

export type A000 = z.infer<typeof A000Schema>;
export type A000Input = z.infer<typeof A000InputSchema>;

/**
 * Encodes an A000 record to fixed-width string format
 * Total line width: 151 characters + CRLF
 */
export function encodeA000(input: A000Input): string {
  const primaryIdentifier = defaultKeyGenerator.getPrimaryIdentifier();

  const fullRecord: A000 = {
    code: 'A000',
    primaryIdentifier,
    systemConstant: SHAAM_VERSION,
    ...input,
  };

  const fields = [
    formatField(fullRecord.code, 4, 'left'), // Record code (4) - Alphanumeric
    formatNumericField(fullRecord.recordNumber, 9), // Record number (9) - Numeric, zero-padded
    formatNumericField(fullRecord.vatId, 9), // VAT ID (9) - Numeric, zero-padded
    formatNumericField(fullRecord.primaryIdentifier, 15), // Field 1004: Primary identifier (15) - Numeric, zero-padded
    formatField(fullRecord.dataFileName, 50, 'left'), // Data file name (50) - Alphanumeric
    formatNumericField(fullRecord.reportPeriodStart, 8), // Report period start (8) - Numeric
    formatNumericField(fullRecord.reportPeriodEnd, 8), // Report period end (8) - Numeric
    formatField(SHAAM_VERSION, 8, 'left'), // System constant (8) - Alphanumeric
    formatField(fullRecord.reserved, 50, 'left'), // Reserved (50) - Alphanumeric
  ];

  return fields.join('') + CRLF;
}

/**
 * Parses a fixed-width A000 record line back to object
 * Expected line length: 151 characters (excluding CRLF)
 */
export function parseA000(line: string): A000 {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 151) {
    throw new Error(`Invalid A000 record length: expected 151 characters, got ${cleanLine.length}`);
  }

  // Extract fields at their fixed positions
  const code = cleanLine.slice(0, 4).trim();
  const recordNumber = cleanLine.slice(4, 13).trim().replace(/^0+/, '') || '0'; // Strip leading zeros
  const vatId = cleanLine.slice(13, 22).trim().replace(/^0+/, '') || '0'; // Strip leading zeros
  const primaryIdentifier = cleanLine.slice(22, 37).trim().replace(/^0+/, '') || '0'; // Strip leading zeros
  const dataFileName = cleanLine.slice(37, 87).trim();
  const reportPeriodStart = cleanLine.slice(87, 95).trim();
  const reportPeriodEnd = cleanLine.slice(95, 103).trim();
  const systemConstant = cleanLine.slice(103, 111).trim();
  const reserved = cleanLine.slice(111, 161).trim();

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
    primaryIdentifier,
    dataFileName,
    reportPeriodStart,
    reportPeriodEnd,
    systemConstant: SHAAM_VERSION,
    reserved,
  };

  // Validate against schema
  return A000Schema.parse(parsed);
}
