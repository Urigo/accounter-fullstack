import {
  balanceSheetArraySchema,
  headerSchema,
  profitLossArraySchema,
  taxAdjustmentArraySchema,
} from '../schemas/index.js';
import {
  IndividualOrCompanyEnum,
  ReportData,
  ValidationErrorDetails,
  ValidationResult,
} from '../types/index.js';
import {
  code104Description,
  code400Description,
  validateCode104,
  validateCode400,
} from './specific-code-validations.js';

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
        path: ['header', ...err.path].join('.'),
        message: err.message,
      });
    });
  }

  // Validate profit and loss
  if (Array.isArray(data.profitAndLoss)) {
    const profitLossValidation = profitLossArraySchema.safeParse(data.profitAndLoss);
    if (!profitLossValidation.success) {
      profitLossValidation.error.errors.map(err => {
        errors.push({
          path: ['profitAndLoss', ...err.path].join('.'),
          message: err.message,
        });
      });
    }
  }

  // Validate tax adjustment
  if (Array.isArray(data.taxAdjustment)) {
    const taxAdjustmentValidation = taxAdjustmentArraySchema.safeParse(data.taxAdjustment);
    if (!taxAdjustmentValidation.success) {
      taxAdjustmentValidation.error.errors.map(err => {
        errors.push({
          path: ['taxAdjustment', ...err.path].join('.'),
          message: err.message,
        });
      });
    }
  }

  // Validate balance sheet
  if (data.balanceSheet.length || data.individualOrCompany === IndividualOrCompanyEnum.COMPANY) {
    const balanceSheetValidation = balanceSheetArraySchema.safeParse(data.balanceSheet);
    if (!balanceSheetValidation.success) {
      balanceSheetValidation.error.errors.map(err => {
        errors.push({
          path: ['balanceSheet', ...err.path].join('.'),
          message: err.message,
        });
      });
    }
  }

  if (data.individualOrCompany === IndividualOrCompanyEnum.COMPANY && !data.balanceSheet) {
    errors.push({
      path: 'balanceSheet',
      message: 'Balance sheet is required for companies',
    });
  }

  if (data.header.profitLossEntryCount !== data.profitAndLoss.length) {
    errors.push({
      path: 'header.profitLossEntryCount',
      message: 'Profit and Loss entry count does not match the number of records',
    });
  }

  if (data.header.taxAdjustmentEntryCount !== data.taxAdjustment.length) {
    errors.push({
      path: 'header.taxAdjustmentEntryCount',
      message: 'Tax Adjustment entry count does not match the number of records',
    });
  }

  if (data.header.balanceSheetEntryCount !== (data.balanceSheet?.length ?? 0)) {
    errors.push({
      path: 'header.balanceSheetEntryCount',
      message: 'Balance Sheet entry count does not match the number of records',
    });
  }

  // validate rule 3.7 profitAndLoss code 6666 equals to taxAdjustment code 100
  const code6666Amount = data.profitAndLoss.find(item => item.code === 6666)?.amount || 0;
  const code100Amount = data.taxAdjustment.find(item => item.code === 100)?.amount || 0;
  if (code6666Amount !== code100Amount) {
    errors.push({
      path: 'custom',
      message: 'Profit and Loss code 6666 must equal Tax Adjustment code 100',
    });
  }

  const validationAmounts = {
    100: 0,
    103: 0,
    104: 0,
    370: 0,
    383: 0,
    400: 0,
  };
  data.taxAdjustment.map(record => {
    if (record.code in validationAmounts) {
      validationAmounts[record.code as keyof typeof validationAmounts] = record.amount;
    }
  });
  const ifrsReportingOption = data.header.ifrsReportingOption;

  // validate code 104 according to rule 2.6
  if (!validateCode104(validationAmounts, ifrsReportingOption)) {
    errors.push({
      path: 'custom',
      message: code104Description(ifrsReportingOption),
    });
  }

  // validate code 400 according to rule 2.7
  if (!validateCode400(validationAmounts, ifrsReportingOption)) {
    errors.push({
      path: 'custom',
      message: code400Description(ifrsReportingOption),
    });
  }

  // validate rule 3.8 profitAndLoss sum of codes 1450 & 2095 equals to balanceSheet code 7800
  const code1450Amount = data.profitAndLoss.find(item => item.code === 1450)?.amount || 0;
  const code2095Amount = data.profitAndLoss.find(item => item.code === 2095)?.amount || 0;
  const balanceSheet7800Amount = data.balanceSheet?.find(item => item.code === 7800)?.amount || 0;

  if (code1450Amount + code2095Amount !== balanceSheet7800Amount) {
    errors.push({
      path: 'custom',
      message: 'Sum of Profit and Loss codes 1450 and 2095 must equal Balance Sheet code 7800',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
