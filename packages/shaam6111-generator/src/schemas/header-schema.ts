import { z } from 'zod';
import {
  AccountingMethod,
  AccountingSystem,
  AuditOpinionType,
  BusinessType,
  CurrencyType,
  IFRSReportingOption,
  ReportingMethod,
  YesNo,
} from '../types/index.js';
import { isValidIsraeliID } from '../validation/id-validation.js';

/**
 * Zod schema for HeaderRecord
 * Enforces strict validation based on the specification.
 */
export const headerSchema = z.object({
  taxFileNumber: z
    .string()
    .min(5, { message: 'Tax file number must include at least 5 digits' })
    .max(9, { message: 'Tax file number must include at most 9 digits' })
    .regex(/^[0-9]+$/, { message: 'Tax file number must contain only digits' })
    .superRefine((val, ctx) => {
      if (!isValidIsraeliID(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid tax file number',
        });
      }
    }),
  taxYear: z
    .string()
    .length(4, { message: 'Tax year must be exactly 4 digits' })
    .regex(/^[0-9]{4}$/, { message: 'Tax year must contain only digits' }),
  idNumber: z
    .string()
    .min(5, { message: 'ID number must include at least 5 digits' })
    .max(9, { message: 'ID number must include at most 9 digits' })
    .regex(/^[0-9]+$/, { message: 'ID number must contain only digits' })
    .superRefine((val, ctx) => {
      if (!isValidIsraeliID(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid ID number',
        });
      }
    }),
  vatFileNumber: z
    .string()
    .min(5, { message: 'VAT file number must include at least 5 digits' })
    .max(9, { message: 'VAT file number must include at most 9 digits' })
    .regex(/^[0-9]+$/, { message: 'VAT file number must contain only digits' })
    .superRefine((val, ctx) => {
      if (!isValidIsraeliID(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid VAT file number',
        });
      }
    })
    .optional(),
  withholdingTaxFileNumber: z
    .string()
    .min(5, { message: 'Withholding tax file number must include at least 5 digits' })
    .max(9, { message: 'Withholding tax file number must include at most 9 digits' })
    .regex(/^[0-9]+$/, { message: 'Withholding tax file number must contain only digits' })
    .superRefine((val, ctx) => {
      if (!isValidIsraeliID(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid withholding tax file number',
        });
      }
    })
    .optional(),
  industryCode: z
    .string()
    .length(4, { message: 'Industry code must be exactly 4 digits' })
    .regex(/^[0-9]+$/, { message: 'Industry code must contain only digits' }),
  businessDescription: z
    .string()
    .max(50, { message: 'Business description cannot exceed 50 characters' })
    .optional(),
  businessType: z.nativeEnum(BusinessType),
  reportingMethod: z.nativeEnum(ReportingMethod),
  accountingMethod: z.nativeEnum(AccountingMethod),
  accountingSystem: z.nativeEnum(AccountingSystem),
  isPartnership: z.nativeEnum(YesNo).optional(),
  includesProfitLoss: z.nativeEnum(YesNo),
  includesTaxAdjustment: z.nativeEnum(YesNo),
  includesBalanceSheet: z.nativeEnum(YesNo),
  profitLossEntryCount: z
    .number()
    .int({ message: 'Profit and loss entry count must be an integer' })
    .min(0, { message: 'Profit and loss entry count cannot be negative' })
    .optional(),
  taxAdjustmentEntryCount: z
    .number()
    .int({ message: 'Tax adjustment entry count must be an integer' })
    .min(0, { message: 'Tax adjustment entry count cannot be negative' })
    .optional(),
  balanceSheetEntryCount: z
    .number()
    .int({ message: 'Balance sheet entry count must be an integer' })
    .min(0, { message: 'Balance sheet entry count cannot be negative' })
    .optional(),
  ifrsImplementationYear: z
    .string()
    .length(4, { message: 'IFRS implementation year must be exactly 4 digits' })
    // Validates years between 2006-2099 or 9999 (special value indicating N/A)
    .regex(/^(200[6-9]|20[1-9][0-9]|9999)$/, { message: 'Invalid IFRS implementation year' })
    .optional(),
  ifrsReportingOption: z.nativeEnum(IFRSReportingOption).optional(),
  softwareRegistrationNumber: z
    .string()
    .length(8, { message: 'Software registration number must be exactly 8 digits' })
    .regex(/^[0-9]+$/, { message: 'Software registration number must contain only digits' })
    .optional(),
  partnershipCount: z
    .number()
    .int({ message: 'Partnership count must be an integer' })
    .min(0, { message: 'Partnership count cannot be negative' })
    .optional(),
  partnershipProfitShare: z
    .number()
    .int({ message: 'Partnership profit share must be an integer' })
    .min(0, { message: 'Partnership profit share cannot be negative' })
    .optional(),
  currencyType: z.nativeEnum(CurrencyType),
  auditOpinionType: z.nativeEnum(AuditOpinionType).optional(),
  amountsInThousands: z.nativeEnum(YesNo),
});

export type HeaderRecord = z.infer<typeof headerSchema>;
