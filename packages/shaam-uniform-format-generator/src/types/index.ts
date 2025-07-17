/**
 * Type definitions for SHAAM uniform format generator
 */

import { z } from 'zod';
// Import DocumentTypeEnum from enums for backward compatibility
import { CurrencyCodeEnum, DocumentTypeEnum } from './enums.js';

// Re-export all enums and types from enums.ts
export * from './enums.js';

// Business metadata schema
export const BusinessMetadataSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
  name: z.string().min(1, 'Business name is required'),
  taxId: z.string().min(1, 'Tax ID is required'),
  address: z
    .object({
      street: z.string().optional(),
      houseNumber: z.string().optional(),
      city: z.string().optional(),
      zip: z.string().optional(),
    })
    .optional(),
  reportingPeriod: z.object({
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
  }),
});

// Document schema
export const DocumentSchema = z.object({
  id: z.string().min(1, 'Document ID is required'),
  type: DocumentTypeEnum.describe('Document type - must be valid SHAAM document type'),
  date: z.string().min(1, 'Document date is required'),
  amount: z.number(),
  description: z.string().optional(),
});

// Journal entry schema
export const JournalEntrySchema = z.object({
  id: z.string().min(1, 'Journal entry ID is required'),
  date: z.string().min(1, 'Journal entry date is required'),
  amount: z.number(),
  accountId: z.string().min(1, 'Account ID is required'),
  description: z.string().optional(),
  // Additional B100 fields to preserve round-trip fidelity
  transactionNumber: z.number().optional(),
  transactionLineNumber: z.number().optional(),
  batchNumber: z.number().optional(),
  transactionType: z.string().optional(),
  referenceDocument: z.string().optional(),
  referenceDocumentType: DocumentTypeEnum.optional(),
  referenceDocument2: z.string().optional(),
  referenceDocumentType2: DocumentTypeEnum.optional(),
  valueDate: z.string().optional(),
  counterAccountKey: z.string().optional(),
  debitCreditIndicator: z.enum(['1', '2']).optional(),
  currencyCode: CurrencyCodeEnum.optional(),
  transactionAmount: z.number().optional(), // Preserve original B100 transaction amount with sign
  foreignCurrencyAmount: z.number().optional(),
  quantityField: z.number().optional(),
  matchingField1: z.string().optional(),
  matchingField2: z.string().optional(),
  branchId: z.string().optional(),
  entryDate: z.string().optional(),
  operatorUsername: z.string().optional(),
  reserved: z.string().optional(),
});

// Account schema
export const AccountSchema = z.object({
  id: z.string().min(1, 'Account ID is required'),
  name: z.string().optional().describe('Account name - optional for round-trip compatibility'),
  sortCode: z.object({
    key: z.string().min(1, 'Account sort code key is required'),
    name: z.string().optional(), // Allow optional for round-trip compatibility with empty descriptions
  }),
  address: z
    .object({
      street: z.string().optional(),
      houseNumber: z.string().optional(),
      city: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  countryCode: z.string().optional(),
  parentAccountKey: z.string().optional(),
  vatId: z.string().optional(),
  accountOpeningBalance: z.number(),
  // Extended fields for B110 records (all optional)
  totalDebits: z.number().optional(),
  totalCredits: z.number().optional(),
  accountingClassificationCode: z.string().optional(),
  branchId: z.string().optional(),
  openingBalanceForeignCurrency: z.number().optional(),
  foreignCurrencyCode: z.string().optional(),
  // Original field values for round-trip fidelity
  originalSupplierCustomerTaxId: z.string().optional(), // Preserve exact original value with spaces
});

// Inventory item schema
export const InventoryItemSchema = z.object({
  id: z.string().min(1, 'Inventory item ID is required'),
  name: z.string().min(1, 'Inventory item name is required'),
  quantity: z.number(),
  unitPrice: z.number(),
});

// Main input schema
export const ReportInputSchema = z.object({
  business: BusinessMetadataSchema,
  documents: z.array(DocumentSchema),
  journalEntries: z.array(JournalEntrySchema),
  accounts: z.array(AccountSchema),
  inventory: z.array(InventoryItemSchema),
});

// Output schema
export const ReportOutputSchema = z.object({
  iniText: z.string(),
  dataText: z.string(),
  iniFile: z.instanceof(File),
  dataFile: z.instanceof(File),
  summary: z.object({
    totalRecords: z.number(),
    perType: z.record(z.string(), z.number()),
    errors: z
      .array(
        z.object({
          recordType: z.string(),
          recordIndex: z.number(),
          field: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
  }),
});

// TypeScript types
export type DocumentType = z.infer<typeof DocumentTypeEnum>;
export type BusinessMetadata = z.infer<typeof BusinessMetadataSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type Account = z.infer<typeof AccountSchema>;
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type ReportInput = z.infer<typeof ReportInputSchema>;
export type ReportOutput = z.infer<typeof ReportOutputSchema>;

// Validation error type
export interface ValidationError {
  recordType: string;
  recordIndex: number;
  field: string;
  message: string;
}

// Generation options
export interface GenerationOptions {
  validationMode?: 'fail-fast' | 'collect-all';
  fileNameBase?: string;
}
