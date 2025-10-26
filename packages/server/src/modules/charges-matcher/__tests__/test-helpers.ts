import { describe, it, expect } from 'vitest';
import type {
  Transaction,
  Document,
  ChargeMatch,
  ChargeMatchesResult,
  AutoMatchChargesResult,
  AggregatedTransaction,
  AggregatedDocument,
  ConfidenceScores,
  ChargeType,
} from '../types.js';
import type { currency, document_type } from '@modules/documents/types.js';

/**
 * Factory for creating mock transactions for testing
 */
export function createMockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const defaultTransaction: Transaction = {
    id: '00000000-0000-0000-0000-000000000001',
    account_id: '00000000-0000-0000-0000-000000000010',
    charge_id: '00000000-0000-0000-0000-000000000020',
    source_id: '00000000-0000-0000-0000-000000000030',
    source_description: 'Test transaction',
    currency: 'ILS' as currency,
    event_date: new Date('2024-01-15'),
    debit_date: new Date('2024-01-16'),
    debit_date_override: null,
    debit_timestamp: new Date('2024-01-16T10:00:00Z'),
    amount: '100.00',
    current_balance: '1000.00',
    business_id: '00000000-0000-0000-0000-000000000040',
    created_at: new Date('2024-01-15T08:00:00Z'),
    updated_at: new Date('2024-01-15T08:00:00Z'),
    is_fee: false,
    counter_account: null,
    currency_rate: '1.0',
    origin_key: 'test-origin',
    source_origin: 'test-bank',
    source_reference: 'test-ref-001',
  };

  return { ...defaultTransaction, ...overrides };
}

/**
 * Factory for creating mock documents for testing
 */
export function createMockDocument(overrides: Partial<Document> = {}): Document {
  const defaultDocument: Document = {
    id: '00000000-0000-0000-0000-000000000002',
    charge_id: '00000000-0000-0000-0000-000000000020',
    creditor_id: '00000000-0000-0000-0000-000000000040',
    debtor_id: '00000000-0000-0000-0000-000000000050',
    currency_code: 'ILS' as currency,
    date: new Date('2024-01-14'),
    total_amount: 100.0,
    type: 'INVOICE' as document_type,
    vat_amount: 17.0,
    no_vat_amount: '83.00',
    serial_number: 'INV-001',
    is_reviewed: false,
    created_at: new Date('2024-01-14T08:00:00Z'),
    modified_at: new Date('2024-01-14T08:00:00Z'),
    image_url: null,
    file_url: null,
    allocation_number: null,
    exchange_rate_override: null,
    file_hash: null,
    vat_report_date_override: null,
  };

  return { ...defaultDocument, ...overrides };
}

/**
 * Factory for creating mock aggregated transaction data
 */
export function createMockAggregatedTransaction(
  overrides: Partial<AggregatedTransaction> = {},
): AggregatedTransaction {
  const defaultAggregated: AggregatedTransaction = {
    amount: 100.0,
    currency: 'ILS' as currency,
    businessId: '00000000-0000-0000-0000-000000000040',
    date: new Date('2024-01-15'),
    debitDate: new Date('2024-01-16'),
    description: 'Test transaction',
  };

  return { ...defaultAggregated, ...overrides };
}

/**
 * Factory for creating mock aggregated document data
 */
export function createMockAggregatedDocument(
  overrides: Partial<AggregatedDocument> = {},
): AggregatedDocument {
  const defaultAggregated: AggregatedDocument = {
    amount: 100.0,
    currency: 'ILS' as currency,
    businessId: '00000000-0000-0000-0000-000000000040',
    date: new Date('2024-01-14'),
    description: 'INV-001',
    type: 'INVOICE' as document_type,
    businessIsCreditor: false,
  };

  return { ...defaultAggregated, ...overrides };
}

/**
 * Factory for creating mock confidence scores
 */
export function createMockConfidenceScores(
  overrides: Partial<ConfidenceScores> = {},
): ConfidenceScores {
  const defaultScores: ConfidenceScores = {
    amount: 1.0,
    currency: 1.0,
    business: 1.0,
    date: 1.0,
  };

  return { ...defaultScores, ...overrides };
}

/**
 * Factory for creating mock charge matches
 */
export function createMockChargeMatch(overrides: Partial<ChargeMatch> = {}): ChargeMatch {
  const defaultMatch: ChargeMatch = {
    chargeId: '00000000-0000-0000-0000-000000000099',
    confidenceScore: 0.95,
  };

  return { ...defaultMatch, ...overrides };
}

/**
 * Helper to calculate expected overall confidence score
 * Formula: (amount × 0.4) + (currency × 0.2) + (business × 0.3) + (date × 0.1)
 */
export function calculateExpectedConfidence(scores: ConfidenceScores): number {
  return scores.amount * 0.4 + scores.currency * 0.2 + scores.business * 0.3 + scores.date * 0.1;
}

/**
 * Helper to round confidence score to 2 decimal places
 */
export function roundConfidence(score: number): number {
  return Math.round(score * 100) / 100;
}

/**
 * Helper to validate a confidence score is within valid range
 */
export function isValidConfidenceScore(score: number): boolean {
  return score >= 0.0 && score <= 1.0;
}

/**
 * Helper to check if a date is within N days of another date
 */
export function isWithinDays(date1: Date, date2: Date, days: number): boolean {
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

/**
 * Helper to calculate days difference between two dates
 */
export function daysDifference(date1: Date, date2: Date): number {
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
