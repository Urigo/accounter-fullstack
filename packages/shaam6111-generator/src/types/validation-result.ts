/**
 * Validation Result interface for reporting validation errors
 * @export
 * @interface ValidationResult
 */
export interface ValidationResult {
  /** Whether the validation passed successfully */
  isValid: boolean;
  /** List of validation error messages */
  errors?: ValidationErrorDetails[];
}

/**
 * Validation Error interface for detailed error information
 * @export
 * @interface ValidationErrorDetails
 */
export interface ValidationErrorDetails {
  /** Error or warning code */
  code?: string;
  /** Error or warning message */
  message: string;
  /** Field or section where the error occurred */
  path?: string;
  /** Value that caused the error */
  value?: unknown;
}

/**
 * Custom error class for validation errors.
 */
export class ValidationError extends Error {
  public errors: ValidationErrorDetails[];

  constructor(message: string, errors: ValidationErrorDetails[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * Custom error class for parsing errors.
 */
export class ParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParsingError';
  }
}
