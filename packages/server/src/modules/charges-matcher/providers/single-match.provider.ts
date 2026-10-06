/**
 * Single-Match Provider
 *
 * Implements the core single-match logic for finding potential charge matches.
 * This is a pure function implementation without database dependencies.
 */

import type { Injector } from 'graphql-modules';
import {
  differenceInTimelessDays,
  maxTimelessDate,
  minTimelessDate,
} from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { isWithinDateWindow } from '../helpers/candidate-filter.helper.js';
import type { Document, DocumentCharge, Transaction, TransactionCharge } from '../types.js';
import { aggregateDocuments } from './document-aggregator.js';
import { scoreMatch } from './match-scorer.provider.js';
import { aggregateTransactions } from './transaction-aggregator.js';

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
  gentleMode?: boolean; // Whether gentle client scoring applied
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
      { cause: error },
    );
  }
}

/**
 * Earliest event_date among transactions
 */
function getEarliestEventDate(transactions: Transaction[]): TimelessDateString | null {
  return minTimelessDate(...transactions.map(tx => tx.event_date));
}

/**
 * Latest non-null date among documents
 */
function getLatestDocumentDate(documents: Document[]): TimelessDateString | null {
  return maxTimelessDate(...documents.map(doc => doc.date));
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
  const earliestTxDate = getEarliestEventDate(txCharge.transactions)!;
  const latestDocDate = getLatestDocumentDate(docCharge.documents)!;

  // Calculate day difference
  return Math.abs(differenceInTimelessDays(earliestTxDate, latestDocDate));
}

/**
 * Find top matches for an unmatched charge
 *
 * @param sourceCharge - The unmatched charge (transactions OR documents)
 * @param candidateCharges - All potential match candidates
 * @param userId - Current user ID
 * @param options - Optional configuration (maxMatches, dateWindowMonths, injector)
 * @returns Top matches sorted by confidence
 * @throws Error if source charge is matched or has validation issues
 */
export async function findMatches(
  sourceCharge: TransactionCharge | DocumentCharge,
  candidateCharges: Array<TransactionCharge | DocumentCharge>,
  userId: string,
  injector: Injector,
  options?: FindMatchesOptions,
): Promise<MatchResult[]> {
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
    }
    return isTransactionCharge(candidate);
  });

  // Step 4: Get source date for window filtering
  // (earliest event_date from transactions, or latest date from documents;
  // validated non-null by the source aggregation above)
  const sourceDate = (
    isSourceTransaction
      ? getEarliestEventDate(sourceCharge.transactions)
      : getLatestDocumentDate(sourceCharge.documents)
  )!;

  // Step 5: Filter candidates by date window
  const windowFilteredCandidates = complementaryCandidates.filter(candidate => {
    const candidateDate = isTransactionCharge(candidate)
      ? getEarliestEventDate(candidate.transactions)
      : getLatestDocumentDate(candidate.documents);

    // Candidates without any date can't fall within the window
    if (!candidateDate) {
      return false;
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

  // Step 8: Score all remaining candidates.
  // Scoring is done in parallel: each `scoreMatch` awaits DataLoader lookups
  // (client + issued-documents status), so a sequential loop would serialize
  // those into an N+1. Running them together lets the loaders batch. Ordering
  // is irrelevant here — results are sorted in Step 9.
  type ScoredCandidate = MatchResult & {
    _txCharge?: TransactionCharge;
    _docCharge?: DocumentCharge;
  };

  const scoredResults = await Promise.all(
    windowFilteredCandidates.map(async (candidate): Promise<ScoredCandidate | null> => {
      try {
        const txCharge = isSourceTransaction
          ? (sourceCharge as TransactionCharge)
          : (candidate as TransactionCharge);
        const docCharge = isSourceTransaction
          ? (candidate as DocumentCharge)
          : (sourceCharge as DocumentCharge);
        const matchScore = await scoreMatch(txCharge, docCharge, userId, injector);

        // Calculate date proximity for tie-breaking
        const dateProximity = calculateDateProximity(txCharge, docCharge);

        return {
          chargeId: candidate.chargeId,
          confidenceScore: matchScore.confidenceScore,
          components: matchScore.components,
          dateProximity,
          gentleMode: matchScore.gentleMode === true,
          _txCharge: txCharge,
          _docCharge: docCharge,
        };
      } catch (error) {
        // Scoring is best-effort: a candidate that can't be scored (mixed
        // currencies, unaggregatable data, a failed lookup, etc.) is skipped
        // rather than failing the batch. Log it so genuine system errors (DB /
        // network) surface instead of silently producing an empty match list.
        console.error(`Failed to score candidate ${candidate.chargeId}:`, error);
        return null;
      }
    }),
  );

  const scoredCandidates = scoredResults.filter(
    (candidate): candidate is ScoredCandidate => candidate !== null,
  );

  // Step 9: Sort by confidence descending, then by date proximity tie-breaker
  scoredCandidates.sort((a, b) => {
    // Primary: confidence score (descending)
    if (a.confidenceScore !== b.confidenceScore) {
      return b.confidenceScore - a.confidenceScore;
    }

    // Tie-breaker:
    // - If both in gentle mode: prefer earlier document (larger proximity)
    // - Otherwise: prefer closer dates (smaller proximity)
    const aProx = a.dateProximity ?? Infinity;
    const bProx = b.dateProximity ?? Infinity;

    if (a.gentleMode && b.gentleMode) {
      return bProx - aProx;
    }

    return aProx - bProx;
  });

  // Step 10: Return top N matches
  const topMatches = scoredCandidates.slice(0, maxMatches);

  // Clean up temporary fields
  return topMatches.map(({ _txCharge, _docCharge, ...match }) => match);
}
