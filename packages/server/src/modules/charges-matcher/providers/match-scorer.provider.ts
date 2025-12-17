import type { Injector } from 'graphql-modules';
import { DocumentType } from '../../../shared/enums.js';
import { ClientsProvider } from '../../financial-entities/providers/clients.provider.js';
import { calculateAmountConfidence } from '../helpers/amount-confidence.helper.js';
import { calculateBusinessConfidence } from '../helpers/business-confidence.helper.js';
import { calculateCurrencyConfidence } from '../helpers/currency-confidence.helper.js';
import { calculateDateConfidence } from '../helpers/date-confidence.helper.js';
import { calculateOverallConfidence } from '../helpers/overall-confidence.helper.js';
import type {
  AggregatedDocument,
  AggregatedTransaction,
  ConfidenceScores,
  DocumentCharge,
  MatchScore,
  TransactionCharge,
} from '../types.js';
import { aggregateDocuments } from './document-aggregator.js';
import { aggregateTransactions } from './transaction-aggregator.js';

/**
 * Select appropriate transaction date based on document type
 * Per specification:
 * - INVOICE/CREDIT_INVOICE: Use event_date
 * - RECEIPT/INVOICE_RECEIPT: Use debit_date (debit_timestamp or debit_date)
 * - OTHER/PROFORMA/UNPROCESSED: Calculate both and use better score
 *
 * @param transaction - Aggregated transaction data
 * @param documentType - Document type being matched
 * @returns The date to use for matching
 */
export function selectTransactionDate(
  transaction: AggregatedTransaction,
  documentType: DocumentType,
): Date {
  switch (documentType) {
    case DocumentType.Invoice:
    case DocumentType.CreditInvoice:
    case DocumentType.Receipt:
    case DocumentType.InvoiceReceipt:
      // For invoices, use event_date
      return transaction.date;

    case DocumentType.Other:
    case DocumentType.Proforma:
    case DocumentType.Unprocessed:
      // For flexible types, use event_date as default
      // (caller should calculate both and use better score)
      return transaction.date;

    default:
      // Fallback to event_date for unknown types
      return transaction.date;
  }
}

/**
 * Score a potential match between transaction charge and document charge
 * Aggregates data from both charges and calculates confidence score
 *
 * @param txCharge - Transaction charge to match
 * @param docCharge - Document charge candidate
 * @param userId - Current user UUID for business extraction
 * @param injector - Optional GraphQL modules injector for provider access (for client matching)
 * @returns Match score with confidence and component breakdown
 * @throws Error if aggregation fails (mixed currencies, multiple businesses, etc.)
 */
export async function scoreMatch(
  txCharge: TransactionCharge,
  docCharge: DocumentCharge,
  userId: string,
  injector: Injector,
): Promise<MatchScore> {
  // Aggregate transaction data
  const aggregatedTransaction = aggregateTransactions(txCharge.transactions);

  // Aggregate document data (includes business extraction and amount normalization)
  const aggregatedDocument = aggregateDocuments(docCharge.documents, userId);

  // // For flexible document types, try both dates and use the better score
  // if (
  //   aggregatedDocument.type === 'OTHER' ||
  //   aggregatedDocument.type === 'PROFORMA' ||
  //   aggregatedDocument.type === 'UNPROCESSED'
  // ) {
  //   // Calculate score with event_date
  //   const scoreWithEventDate = await calculateScoreWithDate(
  //     aggregatedTransaction,
  //     aggregatedDocument,
  //     aggregatedTransaction.date,
  //     docCharge.chargeId,
  //     injector,
  //   );

  //   // Calculate score with debit_date (if available)
  //   if (aggregatedTransaction.debitDate) {
  //     const scoreWithDebitDate = await calculateScoreWithDate(
  //       aggregatedTransaction,
  //       aggregatedDocument,
  //       aggregatedTransaction.debitDate,
  //       docCharge.chargeId,
  //       injector,
  //     );

  //     // Return the better score
  //     return scoreWithEventDate.confidenceScore > scoreWithDebitDate.confidenceScore
  //       ? scoreWithEventDate
  //       : scoreWithDebitDate;
  //   }

  //   return scoreWithEventDate;
  // }

  // For specific document types, use the appropriate date
  const transactionDate = selectTransactionDate(
    aggregatedTransaction,
    aggregatedDocument.type as DocumentType,
  );

  return calculateScoreWithDate(
    aggregatedTransaction,
    aggregatedDocument,
    transactionDate,
    docCharge.chargeId,
    injector,
  );
}

/**
 * Helper function to calculate match score with a specific transaction date
 * @param transaction - Aggregated transaction
 * @param document - Aggregated document
 * @param transactionDate - Date to use from transaction
 * @param chargeId - Document charge ID
 * @param injector - Optional GraphQL modules injector for provider access
 * @returns Match score
 */
async function calculateScoreWithDate(
  transaction: Omit<AggregatedTransaction, 'debitDate'>,
  document: Omit<AggregatedDocument, 'businessIsCreditor'>,
  transactionDate: Date,
  chargeId: string,
  injector: Injector,
): Promise<MatchScore> {
  // Check if transaction and document share the same business entity
  const businessesMatch =
    transaction.businessId != null && transaction.businessId === document.businessId;

  // If businesses match, verify if it's a registered CLIENT
  // This gives recurring client charges a flat date confidence regardless of date offset
  let isClientMatch = false;
  if (businessesMatch && transaction.businessId) {
    try {
      const client = await injector
        .get(ClientsProvider)
        .getClientByIdLoader.load(transaction.businessId);
      // isClientMatch is true only if business is a registered client
      isClientMatch = client != null;
    } catch (error) {
      throw new Error(
        `Failed to lookup client for business ID ${transaction.businessId}: ${(error as Error).message}`,
      );
    }
  }

  // Calculate individual confidence scores
  const amountScore = calculateAmountConfidence(transaction.amount, document.amount);
  const currencyScore = calculateCurrencyConfidence(transaction.currency, document.currency);
  const businessScore = calculateBusinessConfidence(transaction.businessId, document.businessId);
  // Pass isClientMatch flag: only true if businesses match AND business is a registered client
  const dateScore = calculateDateConfidence(transactionDate, document.date, isClientMatch);

  // Create components object
  const components: ConfidenceScores = {
    amount: amountScore,
    currency: currencyScore,
    business: businessScore,
    date: dateScore,
  };

  // Calculate overall confidence
  const confidenceScore = calculateOverallConfidence(components);

  return {
    chargeId,
    confidenceScore,
    components,
  };
}
