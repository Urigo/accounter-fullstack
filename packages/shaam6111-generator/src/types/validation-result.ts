/**
 * Validation Result interface for reporting validation errors
 * @export
 * @interface ValidationResult
 */
export interface ValidationResult {
  /** Whether the validation passed successfully */
  isValid: boolean;
  /** List of validation error messages */
  errors: ValidationError[];
  /** List of validation warning messages */
  warnings: ValidationError[];
}

/**
 * Validation Error interface for detailed error information
 * @export
 * @interface ValidationError
 */
export interface ValidationError {
  /** Error or warning code */
  code: string;
  /** Error or warning message */
  message: string;
  /** Field or section where the error occurred */
  field?: string;
  /** Value that caused the error */
  value?: unknown;
}
