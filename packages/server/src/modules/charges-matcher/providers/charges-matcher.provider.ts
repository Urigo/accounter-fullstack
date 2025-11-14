/**
 * Charges Matcher Provider
 *
 * Provides database-integrated charge matching functionality using the Injector pattern.
 * Integrates with existing modules: charges, transactions, and documents.
 */

import { subYears } from 'date-fns';
import { Injectable, Scope } from 'graphql-modules';
import { mergeChargesExecutor } from '@modules/charges/helpers/merge-charges.hepler.js';
import { ChargesTempProvider } from '@modules/charges/providers/charges-temp.provider.js';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { dateToTimelessDateString } from '@shared/helpers';
import { validateChargeIsUnmatched } from '../helpers/charge-validator.helper.js';
import {
  ChargeType,
  type AutoMatchChargesResult,
  type ChargeMatchesResult,
  type ChargeWithData,
  type Document,
  type DocumentCharge,
  type Transaction,
  type TransactionCharge,
} from '../types.js';
import { determineMergeDirection, processChargeForAutoMatch } from './auto-match.provider.js';
import { aggregateDocuments } from './document-aggregator.js';
import { findMatches, type MatchResult } from './single-match.provider.js';
import { aggregateTransactions } from './transaction-aggregator.js';

/**
 * Charges Matcher Provider
 *
 * Provides high-level charge matching operations with database integration.
 * Uses the Injector pattern to access existing providers from other modules.
 */
@Injectable({
  scope: Scope.Operation,
})
export class ChargesMatcherProvider {
  /**
   * Find potential matches for an unmatched charge
   *
   * @param chargeId - ID of the unmatched charge to find matches for
   * @param injector - GraphQL modules injector for provider access
   * @returns Top 5 matches ordered by confidence score
   * @throws Error if charge not found
   * @throws Error if charge is already matched
   * @throws Error if charge data is invalid
   */
  async findMatchesForCharge(
    chargeId: string,
    context: GraphQLModules.AppContext,
  ): Promise<ChargeMatchesResult> {
    const {
      adminContext: { defaultAdminBusinessId: adminBusinessId },
      injector,
    } = context;
    // Get current user ID from context
    if (!adminBusinessId) {
      throw new Error('Admin business not found in context');
    }

    // Get providers from injector
    const chargesTempProvider = injector.get(ChargesTempProvider);
    const chargesProvider = injector.get(ChargesProvider);
    const transactionsProvider = injector.get(TransactionsProvider);
    const documentsProvider = injector.get(DocumentsProvider);

    // Step 1: Load source charge data
    const sourceCharge = await chargesTempProvider.getChargeByIdLoader.load(chargeId);
    if (sourceCharge instanceof Error) {
      throw new Error(`Source charge not found: ${chargeId}`);
    }

    // Step 2: Load transactions and documents for source charge
    const sourceTransactions = (await transactionsProvider.transactionsByChargeIDLoader.load(
      chargeId,
    )) as Transaction[];
    const sourceDocuments = (await documentsProvider.getDocumentsByChargeIdLoader.load(
      chargeId,
    )) as Document[];

    // Step 3: Validate source charge is unmatched
    const sourceChargeWithData = {
      ...sourceCharge,
      transactions: sourceTransactions,
      documents: sourceDocuments,
    };
    validateChargeIsUnmatched(sourceChargeWithData);

    // Step 4: Determine reference date and date window from source charge
    let referenceDate: Date;
    const hasTransactions = sourceTransactions && sourceTransactions.length > 0;
    if (hasTransactions) {
      // Use earliest transaction event_date
      const aggregated = aggregateTransactions(sourceTransactions);
      referenceDate = aggregated.date;
    } else {
      // Use latest document date
      const aggregated = aggregateDocuments(sourceDocuments, adminBusinessId);
      referenceDate = aggregated.date;
    }

    // Step 5: Load candidate charges from database
    // Use 12-month window centered on reference date
    const windowStart = new Date(referenceDate);
    windowStart.setMonth(windowStart.getMonth() - 12);
    const windowEnd = new Date(referenceDate);
    windowEnd.setMonth(windowEnd.getMonth() + 12);

    const candidateCharges = await chargesProvider.getChargesByFilters({
      ownerIds: [adminBusinessId],
      fromAnyDate: dateToTimelessDateString(windowStart),
      toAnyDate: dateToTimelessDateString(windowEnd),
    });

    // Step 6: Load transactions and documents for all candidate charges
    const candidateChargesWithData: Array<TransactionCharge | DocumentCharge> = [];

    await Promise.all(
      candidateCharges.map(async candidate => {
        // Skip the source charge itself
        if (candidate.id === chargeId) {
          return;
        }

        const candidateTransactionsPromise = transactionsProvider.transactionsByChargeIDLoader.load(
          candidate.id,
        ) as Promise<Transaction[]>;
        const candidateDocumentsPromise = documentsProvider.getDocumentsByChargeIdLoader.load(
          candidate.id,
        ) as Promise<Document[]>;
        const [candidateTransactions, candidateDocuments] = await Promise.all([
          candidateTransactionsPromise,
          candidateDocumentsPromise,
        ]);

        const hasTxs = candidateTransactions && candidateTransactions.length > 0;
        const hasDocs = candidateDocuments && candidateDocuments.length > 0;

        // Only include unmatched charges (not both types)
        if (hasTxs && !hasDocs) {
          candidateChargesWithData.push({
            chargeId: candidate.id,
            transactions: candidateTransactions,
          });
        } else if (hasDocs && !hasTxs) {
          candidateChargesWithData.push({
            chargeId: candidate.id,
            documents: candidateDocuments,
          });
        }
        // Skip matched charges (have both) and empty charges (have neither)
      }),
    );

    // Step 7: Build source charge object for findMatches
    let sourceChargeData: TransactionCharge | DocumentCharge;
    if (hasTransactions) {
      sourceChargeData = {
        chargeId,
        transactions: sourceTransactions,
      };
    } else {
      sourceChargeData = {
        chargeId,
        documents: sourceDocuments,
      };
    }

    // Step 8: Call core findMatches function
    const matches: MatchResult[] = findMatches(
      sourceChargeData,
      candidateChargesWithData,
      adminBusinessId,
      {
        maxMatches: 5,
        dateWindowMonths: 12,
      },
    );

    // Step 9: Format and return result
    return {
      matches: matches.map(match => ({
        chargeId: match.chargeId,
        confidenceScore: match.confidenceScore,
      })),
    };
  }

  /**
   * Auto-match all unmatched charges
   *
   * Automatically merges charges that have a single high-confidence match (≥0.95).
   * Skips charges with multiple high-confidence matches (ambiguous).
   * Processes all unmatched charges and returns a summary of actions taken.
   *
   * @param injector - GraphQL modules injector for provider access
   * @param context - GraphQL context with user information
   * @returns Summary of matches made, skipped charges, and errors
   */
  async autoMatchCharges(context: GraphQLModules.AppContext): Promise<AutoMatchChargesResult> {
    const {
      adminContext: { defaultAdminBusinessId: adminBusinessId },
      injector,
    } = context;
    // Get current user ID from context
    if (!adminBusinessId) {
      throw new Error('Admin business not found in context');
    }

    // Get providers from injector
    const chargesProvider = injector.get(ChargesProvider);
    const transactionsProvider = injector.get(TransactionsProvider);
    const documentsProvider = injector.get(DocumentsProvider);

    // Step 1: Load all charges for this user
    const prevYear = dateToTimelessDateString(subYears(new Date(), 1));
    const allCharges = await chargesProvider.getChargesByFilters({
      ownerIds: [adminBusinessId],
      fromAnyDate: prevYear,
    });

    // Step 2: Load transactions and documents for all charges
    const chargesWithData: ChargeWithData[] = [];
    const mergedChargeIds = new Set<string>(); // Track merged charges to exclude from processing

    await Promise.all(
      allCharges.map(async charge => {
        const transactionsPromise = transactionsProvider.transactionsByChargeIDLoader.load(
          charge.id,
        ) as Promise<Transaction[]>;
        const documentsPromise = documentsProvider.getDocumentsByChargeIdLoader.load(
          charge.id,
        ) as Promise<Document[]>;

        const [transactions, documents] = await Promise.all([
          transactionsPromise,
          documentsPromise,
        ]);

        chargesWithData.push({
          chargeId: charge.id,
          ownerId: charge.owner_id ?? adminBusinessId,
          type: ChargeType.TRANSACTION_ONLY, // Will be determined by processChargeForAutoMatch
          description: charge.user_description ?? undefined,
          transactions: transactions || [],
          documents: documents || [],
        });
      }),
    );

    // Step 3: Filter to get only unmatched charges
    const unmatchedCharges = chargesWithData.filter(charge => {
      const hasTx = charge.transactions && charge.transactions.length > 0;
      const hasDocs = charge.documents && charge.documents.length > 0;
      return (hasTx && !hasDocs) || (!hasTx && hasDocs);
    });

    // Step 4: Process each unmatched charge
    const result: AutoMatchChargesResult = {
      totalMatches: 0,
      mergedCharges: [],
      skippedCharges: [],
      errors: [],
    };

    for (const sourceCharge of unmatchedCharges) {
      // Skip if this charge was already merged in this run
      if (mergedChargeIds.has(sourceCharge.chargeId)) {
        continue;
      }

      try {
        // Get candidates (exclude already merged charges)
        const candidates = chargesWithData.filter(
          c => c.chargeId !== sourceCharge.chargeId && !mergedChargeIds.has(c.chargeId),
        );

        // Process this charge for auto-match
        const processResult = processChargeForAutoMatch(sourceCharge, candidates, adminBusinessId);

        if (processResult.status === 'matched' && processResult.match) {
          // Found a single high-confidence match - execute merge
          const matchedChargeId = processResult.match.chargeId;
          const matchedCharge = chargesWithData.find(c => c.chargeId === matchedChargeId);

          if (!matchedCharge) {
            result.errors.push(
              `Matched charge ${matchedChargeId} not found in charge pool for ${sourceCharge.chargeId}`,
            );
            continue;
          }

          // Determine merge direction
          const [sourceToMerge, targetToKeep] = determineMergeDirection(
            sourceCharge,
            matchedCharge,
          );

          try {
            // Execute merge via existing merge functionality
            await mergeChargesExecutor([sourceToMerge.chargeId], targetToKeep.chargeId, injector);

            // Track successful merge
            result.totalMatches++;
            result.mergedCharges.push({
              chargeId: targetToKeep.chargeId,
              confidenceScore: processResult.match.confidenceScore,
            });

            // Mark both charges as processed (merged away charge and kept charge)
            mergedChargeIds.add(sourceToMerge.chargeId);
            mergedChargeIds.add(targetToKeep.chargeId); // Don't process the kept charge again
          } catch (mergeError) {
            result.errors.push(
              `Failed to merge ${sourceToMerge.chargeId} into ${targetToKeep.chargeId}: ${
                mergeError instanceof Error ? mergeError.message : String(mergeError)
              }`,
            );
          }
        } else if (processResult.status === 'skipped') {
          // Multiple high-confidence matches - ambiguous
          result.skippedCharges.push(sourceCharge.chargeId);
        }
        // status === 'no-match': do nothing, silently skip
      } catch (error) {
        // Capture error but continue processing other charges
        result.errors.push(
          `Error processing charge ${sourceCharge.chargeId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return result;
  }
}
