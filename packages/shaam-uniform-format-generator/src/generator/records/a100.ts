import { z } from 'zod';
import { SHAAM_VERSION } from '../../constants.js';
import { CRLF } from '../../format/index.js';
import { formatField, formatNumericField } from '../index.js';

/**
 * A100 Record Schema - Business opening record
 * Fields 1100-1105 based on SHAAM 1.31 specification table
 */
export const A100Schema = z.object({
  // Field 1100: Record code (4) - Required - Alphanumeric
  code: z.literal('A100').describe('Record type code - always "A100"'),
  // Field 1101: Record number in file (9) - Required - Numeric
  recordNumber: z
    .string()
    .min(1)
    .max(9)
    .regex(/^\d+$/)
    .describe('Sequential record number in BKMVDATA file'),
  // Field 1102: Tax ID (9) - Required - Numeric
  vatId: z.string().min(1).max(9).regex(/^\d+$/).describe('VAT identification number'),
  // Field 1103: Primary identifier (15) - Required - Numeric
  primaryIdentifier: z
    .string()
    .min(1)
    .max(15)
    .regex(/^\d+$/)
    .describe('Fixed and unique primary identifier - see Note 2'),
  // Field 1104: System constant (8) - Required - Alphanumeric - Value: &OF1.31&
  systemConstant: z
    .literal(SHAAM_VERSION)
    .optional()
    .describe(`System constant - always "${SHAAM_VERSION}"`),
  // Field 1105: Reserved field (50) - Optional - Alphanumeric
  reserved: z.string().max(50).default('').describe('Reserved field for future use'),
});

export type A100 = z.infer<typeof A100Schema>;

/**
 * Encodes an A100 record to fixed-width string format
 * Total line width: 95 characters + CRLF
 */
export function encodeA100(input: A100): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1100: Record code (4) - Alphanumeric
    formatNumericField(input.recordNumber, 9), // Field 1101: Record number (9) - Numeric, zero-padded
    formatNumericField(input.vatId, 9), // Field 1102: VAT ID (9) - Numeric, zero-padded
    formatNumericField(input.primaryIdentifier, 15), // Field 1103: Primary identifier (15) - Numeric, zero-padded
    formatField(SHAAM_VERSION, 8, 'left'), // Field 1104: System constant (8) - Alphanumeric
    formatField(input.reserved, 50, 'left'), // Field 1105: Reserved (50) - Alphanumeric
  ];

  return fields.join('') + CRLF;
}

/**
 * Parses a fixed-width A100 record line back to object
 * Expected line length: 95 characters (excluding CRLF)
 */
export function parseA100(line: string): A100 {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 95) {
    throw new Error(`Invalid A100 record length: expected 95 characters, got ${cleanLine.length}`);
  }

  // Extract fields at their fixed positions
  const code = cleanLine.slice(0, 4).trim();
  const recordNumber = cleanLine.slice(4, 13).trim().replace(/^0+/, '') || '0'; // Strip leading zeros
  const vatId = cleanLine.slice(13, 22).trim().replace(/^0+/, '') || '0'; // Strip leading zeros
  const primaryIdentifier = cleanLine.slice(22, 37).trim().replace(/^0+/, '') || '0'; // Strip leading zeros
  const systemConstant = cleanLine.slice(37, 45).trim();
  const reserved = cleanLine.slice(45, 95).trim();

  // Validate the code field
  if (code !== 'A100') {
    throw new Error(`Invalid A100 record code: expected "A100", got "${code}"`);
  }

  // Validate the system constant field
  if (systemConstant !== '&OF1.31&') {
    throw new Error(`Invalid system constant: expected "&OF1.31&", got "${systemConstant}"`);
  }

  const parsed: A100 = {
    code,
    recordNumber,
    vatId,
    primaryIdentifier,
    systemConstant: '&OF1.31&', // Always use the literal constant
    reserved,
  };

  // Validate against schema
  return A100Schema.parse(parsed);
}
