import { z } from 'zod';
import { IndividualOrCompanyEnum } from '../types/index.js';
import {
  code104Description,
  code400Description,
  validateCode104,
  validateCode400,
} from '../validation/specific-code-validations.js';
import { headerSchema } from './header-schema.js';
import {
  balanceSheetArraySchema,
  profitLossArraySchema,
  taxAdjustmentArraySchema,
} from './index.js';

/**
 * Zod schema for the full report
 * Enforces strict validation based on the specification.
 */
export const reportSchema = z
  .object({
    header: headerSchema,
    profitAndLoss: profitLossArraySchema,
    taxAdjustment: taxAdjustmentArraySchema,
    balanceSheet: balanceSheetArraySchema.optional(),
    individualOrCompany: z.nativeEnum(IndividualOrCompanyEnum),
  })
  .superRefine((data, ctx) => {
    // validate balance sheet exists for companies
    if (data.individualOrCompany === IndividualOrCompanyEnum.COMPANY && !data.balanceSheet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Balance sheet is required for companies',
      });
    }

    if (data.header.profitLossEntryCount !== data.profitAndLoss.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Profit and Loss entry count does not match the number of records',
      });
    }

    if (data.header.taxAdjustmentEntryCount !== data.taxAdjustment.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tax Adjustment entry count does not match the number of records',
      });
    }

    if (data.header.balanceSheetEntryCount !== (data.balanceSheet?.length ?? 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Balance Sheet entry count does not match the number of records',
      });
    }

    // validate rule 3.7 profitAndLoss code 6666 equals to taxAdjustment code 100
    const code6666Amount = data.profitAndLoss.find(item => item.code === 6666)?.amount || 0;
    const code100Amount = data.taxAdjustment.find(item => item.code === 100)?.amount || 0;
    if (code6666Amount !== code100Amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
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
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: code104Description(ifrsReportingOption),
      });
    }

    // validate code 400 according to rule 2.7
    if (!validateCode400(validationAmounts, ifrsReportingOption)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: code400Description(ifrsReportingOption),
      });
    }

    // validate rule 3.8 profitAndLoss sum of codes 1450 & 2095 equals to balanceSheet code 7800
    const code1450Amount = data.profitAndLoss.find(item => item.code === 1450)?.amount || 0;
    const code2095Amount = data.profitAndLoss.find(item => item.code === 2095)?.amount || 0;
    const balanceSheet7800Amount = data.balanceSheet?.find(item => item.code === 7800)?.amount || 0;

    if (code1450Amount + code2095Amount !== balanceSheet7800Amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sum of Profit and Loss codes 1450 and 2095 must equal Balance Sheet code 7800',
      });
    }
  });
