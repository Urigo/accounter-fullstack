import { z } from 'zod';
import { SHAAM_VERSION } from '../../constants.js';
import { CRLF } from '../../format/index.js';
import { defaultKeyGenerator } from '../../utils/key-generator.js';
import { formatField, formatNumericField } from '../format/encoder.js';

/**
 * Z900 Record Schema - Closing record
 * Fields 1150-1156 based on SHAAM 1.31 specification
 */
export const Z900Schema = z.object({
  code: z.literal('Z900').describe('Record type code - always "Z900"'),
  recordNumber: z.number().int().min(1).max(999_999_999).describe('Sequential record number'),
  vatId: z.string().min(1).max(9).describe('VAT identification number - numeric field'),
  uniqueId: z.number().int().min(1).max(999_999_999_999_999).describe('Unique business identifier'),
  totalRecords: z
    .number()
    .int()
    .min(1)
    .max(999_999_999_999_999)
    .describe('Total number of records in file'),
  reserved: z.string().max(50).default('').describe('Reserved field for future use'),
});

/**
 * Z900 Input Schema - for user input (excludes auto-generated fields)
 * Field 1153 (uniqueId) is automatically generated to match field 1103
 */
export const Z900InputSchema = Z900Schema.omit({
  uniqueId: true,
  code: true,
});

export type Z900 = z.infer<typeof Z900Schema>;
export type Z900Input = z.infer<typeof Z900InputSchema>;

/**
 * Encodes a Z900 record to fixed-width string format
 * Total line width: 110 characters + CRLF
 */
export function encodeZ900(input: Z900Input): string {
  const uniqueId = parseInt(defaultKeyGenerator.getPrimaryIdentifier(), 10);

  const fullRecord: Z900 = {
    code: 'Z900',
    uniqueId,
    ...input,
  };

  const fields = [
    formatField(fullRecord.code, 4, 'left'), // Field 1150: Record code (4) - Alphanumeric
    formatNumericField(fullRecord.recordNumber.toString(), 9), // Field 1151: Record number (9) - Numeric
    formatNumericField(fullRecord.vatId, 9), // Field 1152: VAT ID (9) - Numeric
    formatNumericField(fullRecord.uniqueId.toString(), 15), // Field 1153: Unique ID (15) - Numeric
    formatField(SHAAM_VERSION, 8, 'left'), // Field 1154: SHAAM version (8) - Alphanumeric
    formatNumericField(fullRecord.totalRecords.toString(), 15), // Field 1155: Total records (15) - Numeric
    formatField(fullRecord.reserved, 50, 'left'), // Field 1156: Reserved (50) - Alphanumeric
  ];

  return fields.join('') + CRLF;
}

/**
 * Parses a fixed-width Z900 record line back to object
 * Expected line length: 110 characters (excluding CRLF)
 */
export function parseZ900(line: string): Z900 {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 110) {
    throw new Error(`Invalid Z900 record length: expected 110 characters, got ${cleanLine.length}`);
  }

  // Extract fields at their fixed positions
  const code = cleanLine.slice(0, 4).trim();
  const recordNumber = parseInt(cleanLine.slice(4, 13).trim().replace(/^0+/, '') || '0', 10);
  const vatId = cleanLine.slice(13, 22).trim().replace(/^0+/, '') || '0';
  const uniqueId = parseInt(cleanLine.slice(22, 37).trim().replace(/^0+/, '') || '0', 10);
  const systemCode = cleanLine.slice(37, 45).trim();
  const totalRecords = parseInt(cleanLine.slice(45, 60).trim().replace(/^0+/, '') || '0', 10);
  const reserved = cleanLine.slice(60, 110).trim();

  // Validate the code field
  if (code !== 'Z900') {
    throw new Error(`Invalid Z900 record code: expected "Z900", got "${code}"`);
  }

  // Validate the SHAAM version field
  if (systemCode !== SHAAM_VERSION) {
    throw new Error(`Invalid SHAAM version: expected "${SHAAM_VERSION}", got "${systemCode}"`);
  }

  const parsed: Z900 = {
    code,
    recordNumber,
    vatId,
    uniqueId,
    totalRecords,
    reserved,
  };

  // Validate against schema
  return Z900Schema.parse(parsed);
}
