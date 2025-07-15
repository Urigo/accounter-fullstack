import { z } from 'zod';
import { SHAAM_VERSION } from '../../constants.js';
import { CRLF, padLeft, padRight } from '../../format/index.js';

/**
 * Helper function to format a field with specified width and alignment
 */
function formatField(value: string, width: number, align: 'left' | 'right'): string {
  if (align === 'left') {
    return padRight(value, width);
  }
  return padLeft(value, width);
}

/**
 * Z900 Record Schema - Closing record
 * Fields 1150-1156 based on SHAAM 1.31 specification
 */
export const Z900Schema = z.object({
  code: z.literal('Z900').describe('Record type code - always "Z900"'),
  recordNumber: z.string().min(1).max(9).describe('Sequential record number'),
  vatId: z.string().min(1).max(9).describe('VAT identification number'),
  uniqueId: z.string().min(1).max(15).describe('Unique business identifier'),
  totalRecords: z.string().min(1).max(15).describe('Total number of records in file'),
  reserved: z.string().max(50).default('').describe('Reserved field for future use'),
});

export type Z900 = z.infer<typeof Z900Schema>;

/**
 * Encodes a Z900 record to fixed-width string format
 * Total line width: 110 characters + CRLF
 */
export function encodeZ900(input: Z900): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1150: Record code (4)
    formatField(input.recordNumber, 9, 'right'), // Field 1151: Record number (9)
    formatField(input.vatId, 9, 'left'), // Field 1152: VAT ID (9)
    formatField(input.uniqueId, 15, 'left'), // Field 1153: Unique ID (15)
    formatField(SHAAM_VERSION, 8, 'left'), // Field 1154: SHAAM version (8)
    formatField(input.totalRecords, 15, 'right'), // Field 1155: Total records (15)
    formatField(input.reserved, 50, 'left'), // Field 1156: Reserved (50)
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
  const recordNumber = cleanLine.slice(4, 13).trim();
  const vatId = cleanLine.slice(13, 22).trim();
  const uniqueId = cleanLine.slice(22, 37).trim();
  const systemCode = cleanLine.slice(37, 45).trim();
  const totalRecords = cleanLine.slice(45, 60).trim();
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
