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
  if (data.header) {
    const headerValidation = headerSchema.safeParse(data.header);
    if (!headerValidation.success) {
      for (const issue of headerValidation.error.issues) {
        errors.push({
          path: `header.${issue.path.join('.')}`,
          message: issue.message,
        });
      }
    }
  } else {
    errors.push({
      path: 'header',
      message: 'Header is required',
    });
  }

  // Validate profit and loss
  if (Array.isArray(data.profitAndLoss)) {
    const profitLossValidation = profitLossArraySchema.safeParse(data.profitAndLoss);
    if (!profitLossValidation.success) {
      for (const issue of profitLossValidation.error.issues) {
        errors.push({
          path: ['profitAndLoss', ...issue.path].join('.'),
          message: issue.message,
        });
      }
    }
  }

  // Validate tax adjustment
  if (Array.isArray(data.taxAdjustment)) {
    const taxAdjustmentValidation = taxAdjustmentArraySchema.safeParse(data.taxAdjustment);
    if (!taxAdjustmentValidation.success) {
      for (const issue of taxAdjustmentValidation.error.issues) {
        errors.push({
          path: ['taxAdjustment', ...issue.path].join('.'),
          message: issue.message,
        });
      }
    }
  }

  const hasBalanceSheet = Array.isArray(data.balanceSheet) && data.balanceSheet.length > 0;

  // Validate balance sheet only when present
  if (hasBalanceSheet) {
    const balanceSheetValidation = balanceSheetArraySchema.safeParse(data.balanceSheet);
    if (!balanceSheetValidation.success) {
      for (const issue of balanceSheetValidation.error.issues) {
        errors.push({
          path: ['balanceSheet', ...issue.path].join('.'),
          message: issue.message,
        });
      }
    }
  }

  // Determine whether a balance sheet **must** be present
  const mustHaveBalanceSheet = data.individualOrCompany === IndividualOrCompanyEnum.COMPANY;

  // Enforce presence for companies
  if (mustHaveBalanceSheet && !hasBalanceSheet) {
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
  const code6666Entry = data.profitAndLoss.find(item => item.code === 6666);
  const code100Entry = data.taxAdjustment.find(item => item.code === 100);
  if (code6666Entry && code100Entry && code6666Entry.amount !== code100Entry.amount) {
    errors.push({
      path: 'custom',
      message: 'Profit and Loss code 6666 must equal Tax Adjustment code 100',
    });
  } else if (!code6666Entry || !code100Entry) {
    errors.push({
      path: 'custom',
      message:
        'Both Profit and Loss code 6666 and Tax Adjustment code 100 must be present and equal',
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
  const code1450Amount = data.profitAndLoss.find(item => item.code === 1450)?.amount;
  const code2095Amount = data.profitAndLoss.find(item => item.code === 2095)?.amount;
  const balanceSheet7800Amount = data.balanceSheet?.find(item => item.code === 7800)?.amount;

  if (
    (code1450Amount !== undefined ||
      code2095Amount !== undefined ||
      balanceSheet7800Amount !== undefined) &&
    (code1450Amount ?? 0) + (code2095Amount ?? 0) !== balanceSheet7800Amount
  ) {
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
