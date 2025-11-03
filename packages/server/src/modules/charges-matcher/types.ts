import type { currency, document_type, IGetAllDocumentsResult } from '@modules/documents/types.js';
import type { IGetTransactionsByIdsResult } from '@modules/transactions/types.js';

/**
 * Re-export shared types from other modules
 */
export type {
  currency as Currency,
  document_type as DocumentType,
} from '@modules/documents/types.js';

/**
 * Transaction interface matching the database schema
 * Uses the complete type from transactions module
 */
export type Transaction = IGetTransactionsByIdsResult;

/**
 * Document interface matching the database schema
 * Uses the complete type from documents module
 */
export type Document = IGetAllDocumentsResult;

/**
 * Represents a single charge match with its confidence score
 */
export interface ChargeMatchProto {
  /** UUID of the matched charge */
  chargeId: string;
  /** Confidence score between 0.00 and 1.00 (two decimal precision) */
  confidenceScore: number;
}

/**
 * Result of finding matches for a single charge
 */
export interface ChargeMatchesResult {
  /** Array of up to 5 matches, ordered by confidence score (highest first) */
  matches: ChargeMatchProto[];
}

/**
 * Represents a charge that was successfully merged during auto-match
 */
export interface MergedCharge {
  /** UUID of the deleted/merged-away charge */
  chargeId: string;
  /** Confidence score that triggered the merge (≥0.95) */
  confidenceScore: number;
}

/**
 * Result of the auto-match operation
 */
export interface AutoMatchChargesResult {
  /** Total number of charges that were successfully matched and merged */
  totalMatches: number;
  /** Array of charges that were merged, with their confidence scores */
  mergedCharges: MergedCharge[];
  /** Array of charge UUIDs that had multiple high-confidence matches and were skipped */
  skippedCharges: string[];
  /** Array of error messages encountered during the operation */
  errors: string[];
}

/**
 * Aggregated transaction data for matching purposes
 */
export interface AggregatedTransaction {
  /** Sum of all transaction amounts */
  amount: number;
  /** Common currency across all transactions */
  currency: currency;
  /** Single non-null business ID (or null if all are null) */
  businessId: string | null;
  /** Earliest event_date among transactions */
  date: Date;
  /** Earliest debit_date/debit_timestamp (for receipt matching) */
  debitDate: Date | null;
  /** Concatenated source_description values */
  description: string;
}

/**
 * Aggregated document data for matching purposes
 */
export interface AggregatedDocument {
  /** Sum of all normalized document amounts */
  amount: number;
  /** Common currency across all documents */
  currency: currency;
  /** Single non-null business ID (or null if all are null) */
  businessId: string | null;
  /** Latest document date */
  date: Date;
  /** Concatenated serial numbers and identifiers */
  description: string;
  /** Document type (for date matching logic) */
  type: document_type;
  /** Whether the business is on the creditor side */
  businessIsCreditor: boolean;
}

/**
 * Individual confidence scores for different matching factors
 */
export interface ConfidenceScores {
  /** Amount confidence (0.0 - 1.0) */
  amount: number;
  /** Currency confidence (0.0 - 1.0) */
  currency: number;
  /** Business confidence (0.0 - 1.0) */
  business: number;
  /** Date confidence (0.0 - 1.0) */
  date: number;
}

/**
 * Complete confidence calculation result
 */
export interface ConfidenceResult {
  /** Overall weighted confidence score */
  overall: number;
  /** Individual component scores */
  scores: ConfidenceScores;
}

/**
 * Charge classification for matching purposes
 */
export enum ChargeType {
  /** Charge has transactions but no accounting documents */
  TRANSACTION_ONLY = 'TRANSACTION_ONLY',
  /** Charge has accounting documents but no transactions */
  DOCUMENT_ONLY = 'DOCUMENT_ONLY',
  /** Charge has both transactions and accounting documents */
  MATCHED = 'MATCHED',
}

/**
 * Charge with its associated data for matching
 */
export interface ChargeWithData {
  /** Charge UUID */
  chargeId: string;
  /** Owner UUID */
  ownerId: string;
  /** Charge classification */
  type: ChargeType;
  /** Associated transactions (if any) */
  transactions: Transaction[];
  /** Associated documents (if any) */
  documents: Document[];
}

/**
 * Candidate charge for matching with aggregated data
 */
export interface MatchCandidate {
  /** Charge UUID */
  chargeId: string;
  /** Aggregated transaction data (if transaction charge) */
  transactionData?: AggregatedTransaction;
  /** Aggregated document data (if document charge) */
  documentData?: AggregatedDocument;
}

/**
 * Match score result with confidence and components
 */
export interface MatchScore {
  /** Charge ID being scored */
  chargeId: string;
  /** Overall confidence score (0.0 - 1.0) */
  confidenceScore: number;
  /** Individual confidence component scores */
  components: ConfidenceScores;
}

/**
 * Transaction charge for matching
 */
export interface TransactionCharge {
  /** Charge UUID */
  chargeId: string;
  /** Array of transactions in the charge */
  transactions: Transaction[];
}

/**
 * Document charge for matching
 */
export interface DocumentCharge {
  /** Charge UUID */
  chargeId: string;
  /** Array of documents in the charge */
  documents: Document[];
}

export * from './__generated__/types.js';
