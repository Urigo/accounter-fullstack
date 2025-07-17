import { z } from 'zod';
import { CRLF } from '../../format/index.js';
import { formatField, formatNumericField } from '../format/encoder.js';

/**
 * A000Sum Record Schema - Record count summary for INI.TXT
 * Fields 1050-1051 based on SHAAM uniform format specification
 */
export const A000SumSchema = z.object({
  // Field 1050: Record Code (4) - Required - Alphanumeric
  code: z.string().min(1).max(4).describe('Record type code being summarized'),
  // Field 1051: Record Count (15) - Required - Numeric
  recordCount: z
    .string()
    .min(1)
    .max(15)
    .regex(/^\d+$/)
    .describe('Total number of records of this type'),
});

/**
 * A000Sum Input Schema - for user input (no auto-generated fields)
 */
export const A000SumInputSchema = A000SumSchema;

export type A000Sum = z.infer<typeof A000SumSchema>;
export type A000SumInput = z.infer<typeof A000SumInputSchema>;

/**
 * Encodes an A000Sum record to fixed-width string format
 * Total line width: 19 characters + CRLF
 */
export function encodeA000Sum(input: A000SumInput): string {
  const fullRecord: A000Sum = {
    ...input,
  };

  const fields = [
    formatField(fullRecord.code, 4, 'left'), // Field 1050: Record code (4)
    formatNumericField(fullRecord.recordCount, 15), // Field 1051: Record count (15)
  ];

  return fields.join('') + CRLF;
}

/**
 * Parses a fixed-width A000Sum record line back to object
 * Expected line length: 19 characters (excluding CRLF)
 */
export function parseA000Sum(line: string): A000Sum {
  // Remove CRLF if present
  const cleanLine = line.replace(/\r?\n$/, '');

  if (cleanLine.length !== 19) {
    throw new Error(
      `Invalid A000Sum record length: expected 19 characters, got ${cleanLine.length}`,
    );
  }

  let offset = 0;

  // Extract fields at their fixed positions
  const code = cleanLine.slice(offset, offset + 4).trim();
  offset += 4; // Field 1050 (4)
  const recordCount =
    cleanLine
      .slice(offset, offset + 15)
      .trim()
      .replace(/^0+/, '') || '0';
  offset += 15; // Field 1051 (15)

  const parsed: A000Sum = {
    code,
    recordCount,
  };

  // Validate against schema
  return A000SumSchema.parse(parsed);
}
