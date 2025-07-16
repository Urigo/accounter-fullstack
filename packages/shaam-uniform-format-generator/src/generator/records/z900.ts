import { z } from 'zod';
import { SHAAM_VERSION } from '../../constants.js';
import { CRLF } from '../../format/index.js';
import { formatField, formatNumericField } from '../format/encoder.js';

/**
 * Z900 Record Schema - Closing record
 * Fields 1150-1156 based on SHAAM 1.31 specification
 */
export const Z900Schema = z.object({
  code: z.literal('Z900').describe('Record type code - always "Z900"'),
  recordNumber: z.string().min(1).max(9).describe('Sequential record number - numeric field'),
  vatId: z.string().min(1).max(9).describe('VAT identification number - numeric field'),
  uniqueId: z.string().min(1).max(15).describe('Unique business identifier - numeric field'),
  totalRecords: z
    .string()
    .min(1)
    .max(15)
    .describe('Total number of records in file - numeric field'),
  reserved: z.string().max(50).default('').describe('Reserved field for future use'),
});

export type Z900 = z.infer<typeof Z900Schema>;

/**
 * Encodes a Z900 record to fixed-width string format
 * Total line width: 110 characters + CRLF
 */
export function encodeZ900(input: Z900): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1150: Record code (4) - Alphanumeric
    formatNumericField(input.recordNumber, 9), // Field 1151: Record number (9) - Numeric
    formatNumericField(input.vatId, 9), // Field 1152: VAT ID (9) - Numeric
    formatNumericField(input.uniqueId, 15), // Field 1153: Unique ID (15) - Numeric
    formatField(SHAAM_VERSION, 8, 'left'), // Field 1154: SHAAM version (8) - Alphanumeric
    formatNumericField(input.totalRecords, 15), // Field 1155: Total records (15) - Numeric
    formatField(input.reserved, 50, 'left'), // Field 1156: Reserved (50) - Alphanumeric
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
  const recordNumber = cleanLine.slice(4, 13).trim().replace(/^0+/, '') || '0';
  const vatId = cleanLine.slice(13, 22).trim().replace(/^0+/, '') || '0';
  const uniqueId = cleanLine.slice(22, 37).trim().replace(/^0+/, '') || '0';
  const systemCode = cleanLine.slice(37, 45).trim();
  const totalRecords = cleanLine.slice(45, 60).trim().replace(/^0+/, '') || '0';
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
