import { z } from 'zod';
import { CRLF, padLeft, padRight } from '../format/index.js';

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
 * A100 Record Schema - Business opening record
 * Fields 1100-1105 based on SHAAM 1.31 specification
 */
export const A100Schema = z.object({
  code: z.string().length(4).describe('Record type code - always "A100"'),
  recordNumber: z.string().min(1).max(9).describe('Sequential record number'),
  vatId: z.string().min(1).max(9).describe('VAT identification number'),
  uniqueId: z.string().min(1).max(15).describe('Unique business identifier'),
  systemCode: z.string().min(1).max(8).describe('Reporting system code'),
  reserved: z.string().max(50).default('').describe('Reserved field for future use'),
});

export type A100 = z.infer<typeof A100Schema>;

/**
 * Encodes an A100 record to fixed-width string format
 * Total line width: 95 characters + CRLF
 */
export function encodeA100(input: A100): string {
  const fields = [
    formatField(input.code, 4, 'left'), // Field 1100: Record code (4)
    formatField(input.recordNumber, 9, 'right'), // Field 1101: Record number (9)
    formatField(input.vatId, 9, 'left'), // Field 1102: VAT ID (9)
    formatField(input.uniqueId, 15, 'left'), // Field 1103: Unique ID (15)
    formatField(input.systemCode, 8, 'left'), // Field 1104: System code (8)
    formatField(input.reserved, 50, 'left'), // Field 1105: Reserved (50)
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
  const recordNumber = cleanLine.slice(4, 13).trim();
  const vatId = cleanLine.slice(13, 22).trim();
  const uniqueId = cleanLine.slice(22, 37).trim();
  const systemCode = cleanLine.slice(37, 45).trim();
  const reserved = cleanLine.slice(45, 95).trim();

  // Validate the code field
  if (code !== 'A100') {
    throw new Error(`Invalid A100 record code: expected "A100", got "${code}"`);
  }

  const parsed: A100 = {
    code,
    recordNumber,
    vatId,
    uniqueId,
    systemCode,
    reserved,
  };

  // Validate against schema
  return A100Schema.parse(parsed);
}
