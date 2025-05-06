import { z } from 'zod';
import {
  AccountingMethod,
  AccountingSystem,
  AuditOpinionType,
  BusinessType,
  CurrencyType,
  IfrsReportingOption,
  ReportingMethod,
  YesNo,
} from '../types/report-data.js';

/**
 * Zod schema for HeaderRecord
 * Enforces strict validation based on the specification.
 */
export const headerSchema = z.object({
  taxFileNumber: z
    .string()
    .length(9, { message: 'Tax file number must be exactly 9 digits' })
    .regex(/^[0-9]+$/, { message: 'Tax file number must contain only digits' }),
  taxYear: z
    .string()
    .length(4, { message: 'Tax year must be exactly 4 digits' })
    .regex(/^[0-9]{4}$/, { message: 'Tax year must contain only digits' }),
  idNumber: z
    .string()
    .length(9, { message: 'ID number must be exactly 9 digits' })
    .regex(/^[0-9]+$/, { message: 'ID number must contain only digits' }),
  vatFileNumber: z
    .string()
    .length(9, { message: 'VAT file number must be exactly 9 digits' })
    .regex(/^[0-9]+$/, { message: 'VAT file number must contain only digits' })
    .optional(),
  withholdingTaxFileNumber: z
    .string()
    .length(9, { message: 'Withholding tax file number must be exactly 9 digits' })
    .regex(/^[0-9]+$/, { message: 'Withholding tax file number must contain only digits' })
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
    .regex(/^(200[6-9]|20[1-9][0-9]|9999)$/, { message: 'Invalid IFRS implementation year' })
    .optional(),
  ifrsReportingOption: z.nativeEnum(IfrsReportingOption).optional(),
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
    .min(0, { message: 'Partnership profit share cannot be negative' })
    .optional(),
  currencyType: z.nativeEnum(CurrencyType),
  auditOpinionType: z.nativeEnum(AuditOpinionType).optional(),
  amountsInThousands: z.nativeEnum(YesNo),
});

export type HeaderRecord = z.infer<typeof headerSchema>;
