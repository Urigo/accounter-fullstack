import { z } from 'zod';
import { SHAAM_VERSION } from '../../constants.js';
import { defaultKeyGenerator } from '../../utils/key-generator.js';
import { formatField, formatNumericField, joinFields } from '../index.js';

/**
 * A100 Record Schema - Business opening record
 * Fields 1100-1105 based on SHAAM 1.31 specification table
 */
export const A100Schema = z.object({
  // Field 1100: Record code (4) - Required - Alphanumeric
  code: z.literal('A100').describe('Record type code - always "A100"'),
  // Field 1101: Record number in file (9) - Required - Numeric
  recordNumber: z
    .number()
    .int()
    .min(1)
    .max(999_999_999)
    .describe('Sequential record number in BKMVDATA file'),
  // Field 1102: Tax ID (9) - Required - Numeric
  vatId: z.string().min(1).max(9).regex(/^\d+$/).describe('VAT identification number'),
  // Field 1103: Primary identifier (15) - Required - Numeric
  primaryIdentifier: z
    .number()
    .int()
    .min(1)
    .max(999_999_999_999_999)
    .describe('Fixed and unique primary identifier - see Note 2'),
  // Field 1104: System constant (8) - Required - Alphanumeric - Value: &OF1.31&
  systemConstant: z
    .literal(SHAAM_VERSION)
    .optional()
    .describe(`System constant - always "${SHAAM_VERSION}"`),
  // Field 1105: Reserved field (50) - Optional - Alphanumeric
  reserved: z.string().max(50).default('').describe('Reserved field for future use'),
});

/**
 * A100 Input Schema - for user input (excludes auto-generated fields)
 * Field 1103 (primaryIdentifier) is automatically generated
 */
export const A100InputSchema = A100Schema.omit({
  primaryIdentifier: true,
  code: true,
  systemConstant: true,
});

export type A100 = z.infer<typeof A100Schema>;
export type A100Input = z.infer<typeof A100InputSchema>;

/**
 * Encodes an A100 record to fixed-width string format
 * Total line width: 95 characters + CRLF
 */
export function encodeA100(input: A100Input): string {
  const primaryIdentifier = parseInt(defaultKeyGenerator.getPrimaryIdentifier(), 10);

  const fullRecord: A100 = {
    code: 'A100',
    primaryIdentifier,
    systemConstant: SHAAM_VERSION,
    ...input,
  };

  const fields = [
    formatField(fullRecord.code, 4, 'left'), // Field 1100: Record code (4) - Alphanumeric
    formatNumericField(fullRecord.recordNumber.toString(), 9), // Field 1101: Record number (9) - Numeric, zero-padded
    formatNumericField(fullRecord.vatId, 9), // Field 1102: VAT ID (9) - Numeric, zero-padded
    formatNumericField(fullRecord.primaryIdentifier.toString(), 15), // Field 1103: Primary identifier (15) - Numeric, zero-padded
    formatField(SHAAM_VERSION, 8, 'left'), // Field 1104: System constant (8) - Alphanumeric
    formatField(fullRecord.reserved, 50, 'left'), // Field 1105: Reserved (50) - Alphanumeric
  ];

  return joinFields(fields);
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
  const recordNumber = parseInt(cleanLine.slice(4, 13).trim().replace(/^0+/, '') || '0', 10); // Strip leading zeros and convert to number
  const vatId = cleanLine.slice(13, 22).trim().replace(/^0+/, '') || '0'; // Strip leading zeros
  const primaryIdentifier = parseInt(cleanLine.slice(22, 37).trim().replace(/^0+/, '') || '0', 10); // Strip leading zeros and convert to number
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
