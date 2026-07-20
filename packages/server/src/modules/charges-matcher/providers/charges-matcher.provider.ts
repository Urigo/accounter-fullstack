/**
 * Charges Matcher Provider
 *
 * Provides database-integrated charge matching functionality using the Injector pattern.
 * Integrates with existing modules: charges, transactions, and documents.
 */

import { subYears } from 'date-fns';
import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { mergeChargesExecutor } from '../../charges/helpers/merge-charges.helper.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { isAccountingDocument, isReceipt } from '../../documents/helpers/common.helper.js';
import { DocumentsProvider } from '../../documents/providers/documents.provider.js';
import { TransactionsProvider } from '../../transactions/providers/transactions.provider.js';
import { chargeRequiresMatch } from '../helpers/awaiting-match-queue.helper.js';
import { classifyCandidateCharge } from '../helpers/candidate-classifier.helper.js';
import { validateChargeIsUnmatched } from '../helpers/charge-validator.helper.js';
import {
  ChargeType,
  type AutoMatchChargesResult,
  type ChargeMatchesResult,
  type ChargeMatchProto,
  type ChargeWithData,
  type DocumentCharge,
  type TransactionCharge,
} from '../types.js';
import { determineMergeDirection, processChargeForAutoMatch } from './auto-match.provider.js';
import { aggregateDocuments } from './document-aggregator.js';
import { findMatches, type MatchResult } from './single-match.provider.js';
import { aggregateTransactions } from './transaction-aggregator.js';

/**
 * Max number of source charges scored concurrently against the shared candidate
 * pool. Scoring loads client / issued-document status via DataLoaders, so an
 * unbounded burst (up to 100 charges for the BY_SCORE queue) could exhaust the DB
 * connection pool or spike CPU; a strictly sequential run would be needlessly slow.
 */
export const MATCH_SCORING_CONCURRENCY = 5;

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
  constructor(
    private adminContextProvider: AdminContextProvider,
    private chargesProvider: ChargesProvider,
    private transactionsProvider: TransactionsProvider,
    private documentsProvider: DocumentsProvider,
    @Inject(CONTEXT) private context: GraphQLModules.ModuleContext,
  ) {}

  /**
   * Find potential matches for an unmatched charge
   *
   * @param chargeId - ID of the unmatched charge to find matches for
   * @returns Top 5 matches ordered by confidence score
   * @throws Error if charge not found
   * @throws Error if charge is already matched
   * @throws Error if charge data is invalid
   */
  async findMatchesForCharge(chargeId: string): Promise<ChargeMatchesResult> {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();

    // Step 1: Load source charge data
    const sourceCharge = await this.chargesProvider.getChargeByIdLoader.load(chargeId);
    if (!sourceCharge || sourceCharge instanceof Error) {
      throw new Error(`Source charge not found: ${chargeId}`);
    }

    // Step 2: Load transactions and documents for source charge
    const sourceTransactions =
      await this.transactionsProvider.transactionsByChargeIDLoader.load(chargeId);
    const sourceDocuments = (
      await this.documentsProvider.getDocumentsByChargeIdLoader.load(chargeId)
    ).filter(doc => isAccountingDocument(doc.type));

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
      const aggregated = aggregateDocuments(sourceDocuments, ownerId);
      referenceDate = aggregated.date;
    }

    // Step 5: Load candidate charges from database
    // Use 12-month window centered on reference date
    const windowStart = new Date(referenceDate);
    windowStart.setMonth(windowStart.getMonth() - 12);
    const windowEnd = new Date(referenceDate);
    windowEnd.setMonth(windowEnd.getMonth() + 12);

    const candidateCharges = await this.chargesProvider.getChargesByFilters({
      ownerIds: [ownerId],
      fromAnyDate: dateToTimelessDateString(windowStart),
      toAnyDate: dateToTimelessDateString(windowEnd),
    });

    // Step 6: Load transactions and documents for the candidate charges,
    // classifying each into the shape the matching algorithm consumes. Charge
    // types that never require a document match (e.g. BANK_DEPOSIT,
    // CREDITCARD_BANK, VAT) are dropped first — they can't be valid matches and
    // skipping them avoids loading their transactions/documents.
    const candidateChargesWithData = await this.hydrateCandidateCharges(
      candidateCharges.filter(chargeRequiresMatch),
      chargeId,
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
    const matches: MatchResult[] = await findMatches(
      sourceChargeData,
      candidateChargesWithData,
      ownerId,
      this.context.injector,
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
   * Find potential matches for a batch of unmatched charges in a single pass.
   *
   * Powers the awaiting-match queue. Instead of re-querying and re-hydrating the
   * candidate pool once per source charge (a heavy, quadratic pattern), it loads
   * and classifies the shared candidate pool **once** for the whole batch, then
   * scores every source charge against that in-memory pool. The per-source date
   * window is still enforced in-memory by `findMatches`, so results are identical
   * to calling `findMatchesForCharge` per charge — just far cheaper.
   *
   * Best-effort per charge: a source that can't be prepared or scored (already
   * matched, missing data, etc.) yields an empty match list rather than failing
   * the whole batch.
   *
   * @param chargeIds - Unmatched source charge UUIDs to evaluate
   * @returns Map from source charge id to its match suggestions (unsorted)
   */
  async findMatchesForCharges(chargeIds: string[]): Promise<Map<string, ChargeMatchProto[]>> {
    const matchesByChargeId = new Map<string, ChargeMatchProto[]>();
    if (chargeIds.length === 0) {
      return matchesByChargeId;
    }

    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();

    // Prepare every source charge (load data, validate, derive reference date).
    // DataLoaders batch these loads across the whole set.
    const preparedSources = await Promise.all(
      chargeIds.map(async chargeId => {
        try {
          const sourceCharge = await this.chargesProvider.getChargeByIdLoader.load(chargeId);
          if (!sourceCharge || sourceCharge instanceof Error) {
            throw new Error(`Source charge not found: ${chargeId}`);
          }

          const [sourceTransactions, sourceDocuments] = await Promise.all([
            this.transactionsProvider.transactionsByChargeIDLoader
              .load(chargeId)
              .then(txs => txs ?? []),
            this.documentsProvider.getDocumentsByChargeIdLoader
              .load(chargeId)
              .then(docs => (docs ?? []).filter(doc => isAccountingDocument(doc.type))),
          ]);

          validateChargeIsUnmatched({
            ...sourceCharge,
            transactions: sourceTransactions,
            documents: sourceDocuments,
          });

          const hasTransactions = sourceTransactions.length > 0;
          const referenceDate = hasTransactions
            ? aggregateTransactions(sourceTransactions).date
            : aggregateDocuments(sourceDocuments, ownerId).date;
          const sourceChargeData: TransactionCharge | DocumentCharge = hasTransactions
            ? { chargeId, transactions: sourceTransactions }
            : { chargeId, documents: sourceDocuments };

          return { chargeId, referenceDate, sourceChargeData };
        } catch (error) {
          // Best-effort: unprepareable sources still appear in the queue, scoreless
          console.error(`Failed to prepare charge ${chargeId} for matching:`, error);
          return { chargeId, referenceDate: null, sourceChargeData: null };
        }
      }),
    );

    const validSources = preparedSources.filter(
      (
        source,
      ): source is {
        chargeId: string;
        referenceDate: Date;
        sourceChargeData: TransactionCharge | DocumentCharge;
      } => source.referenceDate != null && source.sourceChargeData != null,
    );

    // Sources that failed preparation get an empty result up front
    for (const source of preparedSources) {
      if (source.referenceDate == null || source.sourceChargeData == null) {
        matchesByChargeId.set(source.chargeId, []);
      }
    }

    if (validSources.length === 0) {
      return matchesByChargeId;
    }

    // Union window covering every source's ±12-month window. A superset of each
    // per-source window; `findMatches` re-applies the per-source window in-memory.
    let windowStart = new Date(validSources[0].referenceDate);
    let windowEnd = new Date(validSources[0].referenceDate);
    for (const { referenceDate } of validSources) {
      if (referenceDate < windowStart) {
        windowStart = new Date(referenceDate);
      }
      if (referenceDate > windowEnd) {
        windowEnd = new Date(referenceDate);
      }
    }
    windowStart.setMonth(windowStart.getMonth() - 12);
    windowEnd.setMonth(windowEnd.getMonth() + 12);

    // Single candidate-pool query + single hydration/classification for the batch.
    // Drop charge types that never require a document match (e.g. BANK_DEPOSIT,
    // CREDITCARD_BANK, VAT) before hydrating — they can't be valid matches and
    // skipping them avoids loading their transactions/documents.
    const candidateCharges = await this.chargesProvider.getChargesByFilters({
      ownerIds: [ownerId],
      fromAnyDate: dateToTimelessDateString(windowStart),
      toAnyDate: dateToTimelessDateString(windowEnd),
    });
    const candidatePool = await this.hydrateCandidateCharges(
      candidateCharges.filter(chargeRequiresMatch),
    );

    // Score sources against the shared pool with bounded concurrency, so a large
    // queue (up to 100 charges for BY_SCORE) can't exhaust the DB pool or spike CPU
    let nextSourceIndex = 0;
    const scoreWorker = async (): Promise<void> => {
      while (nextSourceIndex < validSources.length) {
        const { chargeId, sourceChargeData } = validSources[nextSourceIndex++];
        try {
          const candidates = candidatePool.filter(candidate => candidate.chargeId !== chargeId);
          const matches = await findMatches(
            sourceChargeData,
            candidates,
            ownerId,
            this.context.injector,
            { maxMatches: 5, dateWindowMonths: 12 },
          );
          matchesByChargeId.set(
            chargeId,
            matches.map(match => ({
              chargeId: match.chargeId,
              confidenceScore: match.confidenceScore,
            })),
          );
        } catch (error) {
          console.error(`Failed to evaluate matches for charge ${chargeId}:`, error);
          matchesByChargeId.set(chargeId, []);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(MATCH_SCORING_CONCURRENCY, validSources.length) }, () =>
        scoreWorker(),
      ),
    );

    return matchesByChargeId;
  }

  /**
   * Load transactions and documents for candidate charges and classify each into
   * the `TransactionCharge` / `DocumentCharge` shape the matcher consumes. Loads
   * are batched via DataLoaders; matched/empty charges are dropped.
   *
   * @param candidateCharges - Charge rows to hydrate
   * @param excludeChargeId - Optional charge id to skip (e.g. the source charge)
   */
  private async hydrateCandidateCharges(
    candidateCharges: Array<{ id: string }>,
    excludeChargeId?: string,
  ): Promise<Array<TransactionCharge | DocumentCharge>> {
    const classified = await Promise.all(
      candidateCharges.map(async candidate => {
        if (excludeChargeId && candidate.id === excludeChargeId) {
          return null;
        }

        const [candidateTransactions, candidateDocuments] = await Promise.all([
          this.transactionsProvider.transactionsByChargeIDLoader
            .load(candidate.id)
            .then(txs => txs ?? []),
          this.documentsProvider.getDocumentsByChargeIdLoader
            .load(candidate.id)
            .then(docs => (docs ?? []).filter(doc => isAccountingDocument(doc.type))),
        ]);

        return classifyCandidateCharge(candidate.id, candidateTransactions, candidateDocuments);
      }),
    );

    return classified.filter(
      (candidate): candidate is TransactionCharge | DocumentCharge => candidate !== null,
    );
  }

  /**
   * Auto-match all unmatched charges
   *
   * Automatically merges charges that have a single high-confidence match (≥0.95).
   * Skips charges with multiple high-confidence matches (ambiguous).
   * Processes all unmatched charges and returns a summary of actions taken.
   *
   * @returns Summary of matches made, skipped charges, and errors
   */
  async autoMatchCharges(): Promise<AutoMatchChargesResult> {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();

    // Step 1: Load all charges for this user
    const prevYear = dateToTimelessDateString(subYears(new Date(), 1));
    const allCharges = await this.chargesProvider.getChargesByFilters({
      ownerIds: [ownerId],
      fromAnyDate: prevYear,
    });

    // Step 2: Load transactions and documents for all charges
    const chargesWithData: ChargeWithData[] = [];
    const mergedChargeIds = new Set<string>(); // Track merged charges to exclude from processing

    await Promise.all(
      allCharges.map(async charge => {
        const transactionsPromise = this.transactionsProvider.transactionsByChargeIDLoader.load(
          charge.id,
        );
        const documentsPromise = this.documentsProvider.getDocumentsByChargeIdLoader
          .load(charge.id)
          .then(docs => docs.filter(doc => isAccountingDocument(doc.type)));

        const [transactions, documents] = await Promise.all([
          transactionsPromise,
          documentsPromise,
        ]);

        chargesWithData.push({
          chargeId: charge.id,
          ownerId: charge.owner_id ?? ownerId,
          type: ChargeType.TRANSACTION_ONLY, // Will be determined by processChargeForAutoMatch
          description: charge.user_description ?? undefined,
          transactions,
          documents,
        });
      }),
    );

    // Step 3: Filter to get only unmatched charges
    const unmatchedCharges = chargesWithData.filter(charge => {
      const hasTx = charge.transactions && charge.transactions.length > 0;
      const hasAccountingDocs =
        charge.documents &&
        charge.documents.filter(doc => isAccountingDocument(doc.type)).length > 0;
      const hasReceipts = charge.documents?.some(doc => isReceipt(doc.type));
      return (hasTx && !hasReceipts) || (!hasTx && hasAccountingDocs);
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
        const processResult = await processChargeForAutoMatch(
          sourceCharge,
          candidates,
          ownerId,
          this.context.injector,
        );

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
            await mergeChargesExecutor(
              [sourceToMerge.chargeId],
              targetToKeep.chargeId,
              this.context.injector,
            );

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
