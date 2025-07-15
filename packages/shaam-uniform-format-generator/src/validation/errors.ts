/**
 * Error handling utilities
 */

import type { ValidationError } from '../types/index.js';

/**
 * Custom error class for SHAAM format generation errors
 */
export class ShaamFormatError extends Error {
  constructor(
    message: string,
    public readonly errors: ValidationError[] = [],
  ) {
    super(message);
    this.name = 'ShaamFormatError';
  }
}

/**
 * Creates a validation error object
 */
export function createValidationError(
  recordType: string,
  recordIndex: number,
  field: string,
  message: string,
): ValidationError {
  return {
    recordType,
    recordIndex,
    field,
    message,
  };
}
