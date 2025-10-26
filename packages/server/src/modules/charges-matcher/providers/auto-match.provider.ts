/**
 * Auto-Match Provider
 *
 * Implements the core auto-match logic for processing all unmatched charges
 * and automatically merging charges with high-confidence matches (≥0.95).
 */

import type { ChargeWithData } from '../types.js';
import { DocumentCharge, TransactionCharge } from './match-scorer.provider.js';
import { findMatches, type MatchResult } from './single-match.provider.js';

/**
 * Result of processing a single charge for auto-matching
 */
export interface ProcessChargeResult {
  /** Match result if a valid match was found, null otherwise */
  match: MatchResult | null;
  /** Status of the processing */
  status: 'matched' | 'skipped' | 'no-match';
  /** Reason for the status (useful for debugging/logging) */
  reason?: string;
}

/**
 * Process a single unmatched charge and find best match
 *
 * This function uses findMatches() from single-match provider with NO date window
 * restriction, then filters for high-confidence matches (≥0.95 threshold).
 *
 * @param sourceCharge - Unmatched charge to process (must have only transactions OR only documents)
 * @param allCandidates - All candidate charges to search (complementary type to source)
 * @param userId - Current user ID for business extraction
 * @returns Processing result with match status
 *
 * @throws Error if sourceCharge is already matched (has both transactions and documents)
 * @throws Error if sourceCharge has no transactions or documents
 * @throws Error if any validation fails (propagated from findMatches)
 */
export function processChargeForAutoMatch(
  sourceCharge: ChargeWithData,
  allCandidates: ChargeWithData[],
  userId: string,
): ProcessChargeResult {
  const AUTO_MATCH_THRESHOLD = 0.95;

  // Prepare source charge for findMatches
  const hasTransactions = sourceCharge.transactions && sourceCharge.transactions.length > 0;
  const hasDocuments = sourceCharge.documents && sourceCharge.documents.length > 0;

  let sourceForMatching: TransactionCharge | DocumentCharge;
  let candidatesForMatching: (TransactionCharge | DocumentCharge)[];

  if (hasTransactions && !hasDocuments) {
    // Transaction charge - convert to TransactionCharge format
    sourceForMatching = {
      chargeId: sourceCharge.chargeId,
      transactions: sourceCharge.transactions,
    };
    // Filter candidates to only document charges
    candidatesForMatching = allCandidates
      .filter(
        c =>
          c.documents && c.documents.length > 0 && (!c.transactions || c.transactions.length === 0),
      )
      .map(c => ({
        chargeId: c.chargeId,
        documents: c.documents,
      }));
  } else if (hasDocuments && !hasTransactions) {
    // Document charge - convert to DocumentCharge format
    sourceForMatching = {
      chargeId: sourceCharge.chargeId,
      documents: sourceCharge.documents,
    };
    // Filter candidates to only transaction charges
    candidatesForMatching = allCandidates
      .filter(
        c =>
          c.transactions && c.transactions.length > 0 && (!c.documents || c.documents.length === 0),
      )
      .map(c => ({
        chargeId: c.chargeId,
        transactions: c.transactions,
      }));
  } else {
    // Invalid charge state
    if (hasTransactions && hasDocuments) {
      throw new Error(
        `Charge ${sourceCharge.chargeId} is already matched (has both transactions and documents)`,
      );
    }
    throw new Error(`Charge ${sourceCharge.chargeId} has no transactions or documents`);
  }

  // Find all matches with no date window restriction
  const allMatches = findMatches(sourceForMatching, candidatesForMatching, userId, {
    dateWindowMonths: undefined, // No date restriction for auto-match
    maxMatches: undefined, // Get all matches, we'll filter by threshold
  });

  // Filter for high-confidence matches (≥0.95)
  const highConfidenceMatches = allMatches.filter(
    match => match.confidenceScore >= AUTO_MATCH_THRESHOLD,
  );

  // Determine result based on number of high-confidence matches
  if (highConfidenceMatches.length === 0) {
    return {
      match: null,
      status: 'no-match',
      reason:
        allMatches.length > 0
          ? `Best match has confidence ${allMatches[0].confidenceScore.toFixed(2)}, below threshold ${AUTO_MATCH_THRESHOLD}`
          : 'No candidates found',
    };
  }

  if (highConfidenceMatches.length === 1) {
    return {
      match: highConfidenceMatches[0],
      status: 'matched',
      reason: `Single high-confidence match found (${highConfidenceMatches[0].confidenceScore.toFixed(2)})`,
    };
  }

  // Multiple high-confidence matches - ambiguous
  return {
    match: null,
    status: 'skipped',
    reason: `${highConfidenceMatches.length} high-confidence matches found (ambiguous)`,
  };
}

/**
 * Determine merge direction for two charges
 *
 * The merge direction follows these rules:
 * 1. If one charge is matched (has both transactions and documents), keep the matched one
 * 2. If both are unmatched, keep the one with transactions (transaction charge is the "anchor")
 * 3. If neither has transactions, keep the first one (arbitrary but consistent)
 *
 * @param charge1 - First charge
 * @param charge2 - Second charge
 * @returns [source, target] tuple where source will be merged INTO target (source is deleted)
 */
export function determineMergeDirection(
  charge1: ChargeWithData,
  charge2: ChargeWithData,
): [ChargeWithData, ChargeWithData] {
  const charge1HasTransactions = charge1.transactions && charge1.transactions.length > 0;
  const charge1HasDocuments = charge1.documents && charge1.documents.length > 0;
  const charge2HasTransactions = charge2.transactions && charge2.transactions.length > 0;
  const charge2HasDocuments = charge2.documents && charge2.documents.length > 0;

  const charge1IsMatched = charge1HasTransactions && charge1HasDocuments;
  const charge2IsMatched = charge2HasTransactions && charge2HasDocuments;

  // Rule 1: If one is matched, keep the matched one
  if (charge1IsMatched && !charge2IsMatched) {
    return [charge2, charge1]; // Merge charge2 INTO charge1 (keep charge1)
  }
  if (charge2IsMatched && !charge1IsMatched) {
    return [charge1, charge2]; // Merge charge1 INTO charge2 (keep charge2)
  }

  // Rule 2: Both unmatched - keep the one with transactions
  if (charge1HasTransactions && !charge2HasTransactions) {
    return [charge2, charge1]; // Merge charge2 INTO charge1 (keep transaction charge)
  }
  if (charge2HasTransactions && !charge1HasTransactions) {
    return [charge1, charge2]; // Merge charge1 INTO charge2 (keep transaction charge)
  }

  // Rule 3: Neither has transactions (both are document-only) or both have transactions
  // Keep charge1 (arbitrary but consistent)
  return [charge2, charge1]; // Merge charge2 INTO charge1 (keep charge1)
}
