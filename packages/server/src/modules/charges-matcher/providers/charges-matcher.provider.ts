/**
 * Charges Matcher Provider
 *
 * Provides database-integrated charge matching functionality using the Injector pattern.
 * Integrates with existing modules: charges, transactions, and documents.
 */

import { Injectable, Injector, Scope } from 'graphql-modules';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { dateToTimelessDateString } from '@shared/helpers';
import type { ChargeMatchesResult, Document, Transaction } from '../types.js';
import { aggregateDocuments } from './document-aggregator.js';
import {
  findMatches,
  type DocumentCharge,
  type MatchResult,
  type TransactionCharge,
} from './single-match.provider.js';
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
    injector: Injector,
    context: GraphQLModules.AppContext,
  ): Promise<ChargeMatchesResult> {
    // Get current user ID from context
    const adminBusinessId = context.adminContext.defaultAdminBusinessId;
    if (!adminBusinessId) {
      throw new Error('Admin business not found in context');
    }

    // Get providers from injector
    const chargesProvider = injector.get(ChargesProvider);
    const transactionsProvider = injector.get(TransactionsProvider);
    const documentsProvider = injector.get(DocumentsProvider);

    // Step 1: Load source charge data
    const sourceCharge = await chargesProvider.getChargeByIdLoader.load(chargeId);
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
    const hasTransactions = sourceTransactions && sourceTransactions.length > 0;
    const hasDocuments = sourceDocuments && sourceDocuments.length > 0;

    if (hasTransactions && hasDocuments) {
      throw new Error(
        `Charge ${chargeId} is already matched (contains both transactions and documents)`,
      );
    }

    if (!hasTransactions && !hasDocuments) {
      throw new Error(`Charge ${chargeId} has no transactions or documents`);
    }

    // Step 4: Determine reference date and date window from source charge
    let referenceDate: Date;
    if (hasTransactions) {
      // Use earliest transaction event_date
      const aggregated = aggregateTransactions(
        sourceTransactions.map(t => ({ ...t, amount: Number(t.amount) })),
      );
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

    for (const candidate of candidateCharges) {
      // Skip the source charge itself
      if (candidate.id === chargeId) {
        continue;
      }

      const candidateTransactions = (await transactionsProvider.transactionsByChargeIDLoader.load(
        candidate.id,
      )) as Transaction[];
      const candidateDocuments = (await documentsProvider.getDocumentsByChargeIdLoader.load(
        candidate.id,
      )) as Document[];

      const hasTxs = candidate.transactions_count && Number(candidate.transactions_count) > 0;
      const hasDocs =
        (candidate.invoices_count && Number(candidate.invoices_count) > 0) ||
        (candidate.receipts_count && Number(candidate.receipts_count) > 0);

      // Only include unmatched charges (not both types)
      if (hasTxs && !hasDocs) {
        candidateChargesWithData.push({
          chargeId: candidate.id,
          transactions: candidateTransactions.map(t => ({ ...t, amount: Number(t.amount) })), // Ensure amount is number
        });
      } else if (hasDocs && !hasTxs) {
        candidateChargesWithData.push({
          chargeId: candidate.id,
          documents: candidateDocuments,
        });
      }
      // Skip matched charges (have both) and empty charges (have neither)
    }

    // Step 7: Build source charge object for findMatches
    let sourceChargeData: TransactionCharge | DocumentCharge;
    if (hasTransactions) {
      sourceChargeData = {
        chargeId,
        transactions: sourceTransactions.map(t => ({ ...t, amount: Number(t.amount) })), // Ensure amount is number
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
}
