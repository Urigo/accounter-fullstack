/**
 * Input validation utilities
 */

import type { ReportInput, ValidationError } from '../types/index.js';
import { ReportInputSchema } from '../types/index.js';

/**
 * Validates report input data against the schema
 *
 * @param input - The input data to validate
 * @param mode - Validation mode ('fail-fast' or 'collect-all')
 * @returns Array of validation errors (empty if valid)
 */
export function validateInput(
  input: ReportInput,
  mode: 'fail-fast' | 'collect-all' = 'fail-fast',
): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    ReportInputSchema.parse(input);
  } catch (error) {
    if (mode === 'fail-fast') {
      throw error;
    }

    // TODO: Convert Zod errors to ValidationError format
    errors.push({
      recordType: 'unknown',
      recordIndex: 0,
      field: 'unknown',
      message: 'Validation failed',
    });
  }

  return errors;
}
