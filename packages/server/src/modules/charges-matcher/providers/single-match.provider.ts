/**
 * Single-Match Provider
 *
 * Implements the core single-match logic for finding potential charge matches.
 * This is a pure function implementation without database dependencies.
 */

import { isWithinDateWindow } from '../helpers/candidate-filter.helper.js';
import type { Document } from '../types.js';
import { aggregateDocuments } from './document-aggregator.js';
import { scoreMatch, type MatchScore } from './match-scorer.provider.js';
import { aggregateTransactions } from './transaction-aggregator.js';

/**
 * Transaction charge - contains only transactions
 */
export interface TransactionCharge {
  chargeId: string;
  transactions: Array<{
    id: string;
    charge_id: string;
    amount: number;
    currency: string;
    business_id: string | null;
    event_date: Date;
    debit_date: Date | null;
    source_description: string | null;
    is_fee: boolean | null;
  }>;
}

/**
 * Document charge - contains only documents
 */
export interface DocumentCharge {
  chargeId: string;
  documents: Document[];
}

/**
 * Match result with score and metadata
 */
export interface MatchResult {
  chargeId: string;
  confidenceScore: number;
  components: {
    amount: number;
    currency: number;
    business: number;
    date: number;
  };
  dateProximity?: number; // Days between earliest tx date and latest doc date (for tie-breaking)
}

/**
 * Options for findMatches function
 */
export interface FindMatchesOptions {
  maxMatches?: number; // Default 5
  dateWindowMonths?: number; // Default 12
}

/**
 * Type guard: check if charge is TransactionCharge
 */
function isTransactionCharge(
  charge: TransactionCharge | DocumentCharge,
): charge is TransactionCharge {
  return 'transactions' in charge && charge.transactions.length > 0;
}

/**
 * Type guard: check if charge is DocumentCharge
 */
function isDocumentCharge(charge: TransactionCharge | DocumentCharge): charge is DocumentCharge {
  return 'documents' in charge && charge.documents.length > 0;
}

/**
 * Validate that source charge is unmatched (has only one type)
 */
function validateUnmatchedCharge(charge: TransactionCharge | DocumentCharge): void {
  const hasTx = 'transactions' in charge && charge.transactions && charge.transactions.length > 0;
  const hasDocs = 'documents' in charge && charge.documents && charge.documents.length > 0;

  if (hasTx && hasDocs) {
    throw new Error(
      `Source charge ${charge.chargeId} is already matched (contains both transactions and documents)`,
    );
  }

  if (!hasTx && !hasDocs) {
    throw new Error(`Source charge ${charge.chargeId} has no transactions or documents`);
  }
}

/**
 * Validate that source charge can be aggregated successfully
 */
function validateSourceAggregation(
  charge: TransactionCharge | DocumentCharge,
  userId: string,
): void {
  try {
    if (isTransactionCharge(charge)) {
      aggregateTransactions(charge.transactions);
    } else {
      aggregateDocuments(charge.documents, userId);
    }
  } catch (error) {
    throw new Error(
      `Source charge ${charge.chargeId} failed validation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Calculate date proximity between transaction and document charges
 * Used for tie-breaking when confidence scores are equal
 *
 * @param txCharge - Transaction charge
 * @param docCharge - Document charge
 * @returns Number of days between earliest transaction date and latest document date
 */
function calculateDateProximity(txCharge: TransactionCharge, docCharge: DocumentCharge): number {
  // Get earliest transaction event_date
  const earliestTxDate = txCharge.transactions.reduce((earliest, tx) => {
    return tx.event_date < earliest ? tx.event_date : earliest;
  }, txCharge.transactions[0].event_date);

  // Get latest document date
  const latestDocDate = docCharge.documents.reduce((latest, doc) => {
    if (!doc.date) return latest;
    return doc.date > latest ? doc.date : latest;
  }, docCharge.documents[0].date!);

  // Calculate day difference
  const diffMs = Math.abs(earliestTxDate.getTime() - latestDocDate.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Find top matches for an unmatched charge
 *
 * @param sourceCharge - The unmatched charge (transactions OR documents)
 * @param candidateCharges - All potential match candidates
 * @param userId - Current user ID
 * @param options - Optional configuration (maxMatches, dateWindowMonths)
 * @returns Top matches sorted by confidence
 * @throws Error if source charge is matched or has validation issues
 */
export function findMatches(
  sourceCharge: TransactionCharge | DocumentCharge,
  candidateCharges: Array<TransactionCharge | DocumentCharge>,
  userId: string,
  options?: FindMatchesOptions,
): MatchResult[] {
  const maxMatches = options?.maxMatches ?? 5;
  const dateWindowMonths = options?.dateWindowMonths ?? 12;

  // Step 1: Validate source charge is unmatched
  validateUnmatchedCharge(sourceCharge);

  // Step 2: Validate source charge aggregation
  validateSourceAggregation(sourceCharge, userId);

  // Step 3: Determine source type and filter candidates by complementary type
  const isSourceTransaction = isTransactionCharge(sourceCharge);
  const complementaryCandidates = candidateCharges.filter(candidate => {
    if (isSourceTransaction) {
      return isDocumentCharge(candidate);
    } else {
      return isTransactionCharge(candidate);
    }
  });

  // Step 4: Get source date for window filtering
  let sourceDate: Date;
  if (isSourceTransaction) {
    // Use earliest event_date from transactions
    sourceDate = sourceCharge.transactions.reduce((earliest, tx) => {
      return tx.event_date < earliest ? tx.event_date : earliest;
    }, sourceCharge.transactions[0].event_date);
  } else {
    // Use latest date from documents
    sourceDate = sourceCharge.documents.reduce((latest, doc) => {
      if (!doc.date) return latest;
      return doc.date > latest ? doc.date : latest;
    }, sourceCharge.documents[0].date!);
  }

  // Step 5: Filter candidates by date window
  const windowFilteredCandidates = complementaryCandidates.filter(candidate => {
    let candidateDate: Date;

    if (isTransactionCharge(candidate)) {
      candidateDate = candidate.transactions.reduce((earliest, tx) => {
        return tx.event_date < earliest ? tx.event_date : earliest;
      }, candidate.transactions[0].event_date);
    } else {
      candidateDate = candidate.documents.reduce((latest, doc) => {
        if (!doc.date) return latest;
        return doc.date > latest ? doc.date : latest;
      }, candidate.documents[0].date!);
    }

    return isWithinDateWindow(sourceDate, candidateDate, dateWindowMonths);
  });

  // Step 6: Filter candidates using candidate filter logic
  // Note: Additional filtering (is_fee, null checks) is handled by aggregators
  // which will throw errors for invalid data

  // Step 7: Exclude candidates with same chargeId
  const sameChargeCandidate = windowFilteredCandidates.find(
    c => c.chargeId === sourceCharge.chargeId,
  );
  if (sameChargeCandidate) {
    throw new Error(
      `Candidate charge ${sameChargeCandidate.chargeId} has the same ID as source charge`,
    );
  }

  // Step 8: Score all remaining candidates
  const scoredCandidates: Array<
    MatchResult & { _txCharge?: TransactionCharge; _docCharge?: DocumentCharge }
  > = [];

  for (const candidate of windowFilteredCandidates) {
    try {
      let matchScore: MatchScore;
      let txCharge: TransactionCharge;
      let docCharge: DocumentCharge;

      if (isSourceTransaction) {
        txCharge = sourceCharge;
        docCharge = candidate as DocumentCharge;
        matchScore = scoreMatch(txCharge, docCharge, userId);
      } else {
        txCharge = candidate as TransactionCharge;
        docCharge = sourceCharge;
        matchScore = scoreMatch(txCharge, docCharge, userId);
      }

      // Calculate date proximity for tie-breaking
      const dateProximity = calculateDateProximity(txCharge, docCharge);

      scoredCandidates.push({
        chargeId: candidate.chargeId,
        confidenceScore: matchScore.confidenceScore,
        components: matchScore.components,
        dateProximity,
        _txCharge: txCharge,
        _docCharge: docCharge,
      });
    } catch (error) {
      // Skip candidates that fail scoring (e.g., mixed currencies, invalid data)
      // This is expected behavior - not all candidates will be scoreable
      continue;
    }
  }

  // Step 9: Sort by confidence descending, then by date proximity ascending (tie-breaker)
  scoredCandidates.sort((a, b) => {
    // Primary: confidence score (descending)
    if (a.confidenceScore !== b.confidenceScore) {
      return b.confidenceScore - a.confidenceScore;
    }

    // Tie-breaker: date proximity (ascending - closer dates win)
    return (a.dateProximity ?? Infinity) - (b.dateProximity ?? Infinity);
  });

  // Step 10: Return top N matches
  const topMatches = scoredCandidates.slice(0, maxMatches);

  // Clean up temporary fields
  return topMatches.map(({ _txCharge, _docCharge, ...match }) => match);
}
