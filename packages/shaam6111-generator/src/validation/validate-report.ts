import { parseReport } from '../parsers/parse-report.js';
import { ValidationErrorDetails, ValidationResult } from '../types/index.js';
import { validateData } from './validate-data.js';

/**
 * Validates a SHAAM6111 report content string.
 * @param content The raw content of the SHAAM6111 report as a string.
 * @returns A ValidationResult object containing validation status and aggregated errors.
 */
export function validateReport(content: string): ValidationResult {
  try {
    // Parse the report
    const reportData = parseReport(content);

    // Validate the parsed data
    return validateData(reportData);
  } catch (error) {
    // Handle parsing errors
    const errors: ValidationErrorDetails[] = [];

    if (error instanceof Error) {
      errors.push({
        path: 'report',
        message: error.message,
      });

      // If the error is a validation error, extract its details
      if ('errors' in error && Array.isArray(error.errors)) {
        error.errors.map((err: ValidationErrorDetails) => {
          errors.push(err);
        });
      }
    } else {
      errors.push({
        path: 'report',
        message: 'Unknown error during report parsing or validation',
      });
    }

    return {
      isValid: false,
      errors,
    };
  }
}
