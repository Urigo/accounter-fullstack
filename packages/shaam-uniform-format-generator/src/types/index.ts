/**
 * Type definitions for SHAAM uniform format generator
 */

import { z } from 'zod';
// Import DocumentTypeEnum from enums for backward compatibility
import { DocumentTypeEnum } from './enums.js';

// Re-export all enums and types from enums.ts
export * from './enums.js';

// Business metadata schema
export const BusinessMetadataSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
  name: z.string().min(1, 'Business name is required'),
  taxId: z.string().min(1, 'Tax ID is required'),
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
});

// Account schema
export const AccountSchema = z.object({
  id: z.string().min(1, 'Account ID is required'),
  name: z.string().min(1, 'Account name is required'),
  type: z.string().min(1, 'Account type is required'),
  balance: z.number(),
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
