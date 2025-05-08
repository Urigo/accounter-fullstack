import {
  balanceSheetArraySchema,
  headerSchema,
  profitLossArraySchema,
  taxAdjustmentArraySchema,
} from '../schemas/index.js';
import { ReportData, ValidationErrorDetails, ValidationResult } from '../types/index.js';

/**
 * Validates a ReportData object using Zod schemas.
 * @param data The ReportData object to validate.
 * @returns A ValidationResult object containing validation status and errors.
 */
export function validateData(data: ReportData): ValidationResult {
  const errors: ValidationErrorDetails[] = [];

  // Validate header
  const headerValidation = headerSchema.safeParse(data.header);
  if (!headerValidation.success) {
    headerValidation.error.errors.map(err => {
      errors.push({
        path: `header.${err.path.join('.')}`,
        message: err.message,
      });
    });
  }

  // Validate profit and loss
  if (data.profitAndLoss) {
    const profitLossValidation = profitLossArraySchema.safeParse(data.profitAndLoss);
    if (!profitLossValidation.success) {
      profitLossValidation.error.errors.map(err => {
        errors.push({
          path: `profitAndLoss.${err.path.join('.')}`,
          message: err.message,
        });
      });
    }
  }

  // Validate tax adjustment
  if (data.taxAdjustment) {
    const taxAdjustmentValidation = taxAdjustmentArraySchema.safeParse(data.taxAdjustment);
    if (!taxAdjustmentValidation.success) {
      taxAdjustmentValidation.error.errors.map(err => {
        errors.push({
          path: `taxAdjustment.${err.path.join('.')}`,
          message: err.message,
        });
      });
    }
  }

  // Validate balance sheet
  if (data.balanceSheet) {
    const balanceSheetValidation = balanceSheetArraySchema.safeParse(data.balanceSheet);
    if (!balanceSheetValidation.success) {
      balanceSheetValidation.error.errors.map(err => {
        errors.push({
          path: `balanceSheet.${err.path.join('.')}`,
          message: err.message,
        });
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
