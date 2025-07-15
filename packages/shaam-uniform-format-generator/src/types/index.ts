/**
 * Type definitions for SHAAM uniform format generator
 */

import { z } from 'zod';

// Business metadata schema
export const BusinessMetadataSchema = z.object({
  businessId: z.string(),
  name: z.string(),
  taxId: z.string(),
  reportingPeriod: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
});

// Document schema
export const DocumentSchema = z.object({
  id: z.string(),
  type: z.string(),
  date: z.string(),
  amount: z.number(),
  description: z.string().optional(),
});

// Journal entry schema
export const JournalEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  amount: z.number(),
  accountId: z.string(),
  description: z.string().optional(),
});

// Account schema
export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  balance: z.number(),
});

// Inventory item schema
export const InventoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
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
