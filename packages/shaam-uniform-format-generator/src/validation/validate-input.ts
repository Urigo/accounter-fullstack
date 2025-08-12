/**
 * Input validation utilities
 */

import { ZodError } from 'zod';
import type { ReportInput, ValidationError } from '../types/index.js';
import { ReportInputSchema } from '../types/index.js';
import { ShaamFormatError } from './errors.js';

/**
 * Converts Zod errors to ValidationError format
 */
function convertZodErrorsToValidationErrors(zodError: ZodError): ValidationError[] {
  return zodError.issues.map((issue, index) => ({
    recordType: 'input',
    recordIndex: typeof issue.path[1] === 'number' ? issue.path[1] : index,
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
    value: issue.input,
  }));
}

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
    if (error instanceof ZodError) {
      const validationErrors = convertZodErrorsToValidationErrors(error);

      if (mode === 'fail-fast') {
        throw new ShaamFormatError(
          `Validation failed: ${validationErrors[0]?.message || 'Unknown error'}`,
          validationErrors,
        );
      }

      errors.push(...validationErrors);
    } else {
      // Handle non-Zod errors
      const unknownError: ValidationError = {
        recordType: 'unknown',
        recordIndex: 0,
        field: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown validation error',
      };

      if (mode === 'fail-fast') {
        throw new ShaamFormatError('Validation failed', [unknownError]);
      }

      errors.push(unknownError);
    }
  }

  return errors;
}
