import type { document_type } from '../../documents/types.js';
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
  documentType: document_type,
): Date {
  switch (documentType) {
    case 'INVOICE':
    case 'CREDIT_INVOICE':
    case 'RECEIPT':
    case 'INVOICE_RECEIPT':
      // For invoices, use event_date
      return transaction.date;

    case 'OTHER':
    case 'PROFORMA':
    case 'UNPROCESSED':
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
 * @returns Match score with confidence and component breakdown
 * @throws Error if aggregation fails (mixed currencies, multiple businesses, etc.)
 */
export function scoreMatch(
  txCharge: TransactionCharge,
  docCharge: DocumentCharge,
  userId: string,
): MatchScore {
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
  //   const scoreWithEventDate = calculateScoreWithDate(
  //     aggregatedTransaction,
  //     aggregatedDocument,
  //     aggregatedTransaction.date,
  //     docCharge.chargeId,
  //   );

  //   // Calculate score with debit_date (if available)
  //   if (aggregatedTransaction.debitDate) {
  //     const scoreWithDebitDate = calculateScoreWithDate(
  //       aggregatedTransaction,
  //       aggregatedDocument,
  //       aggregatedTransaction.debitDate,
  //       docCharge.chargeId,
  //     );

  //     // Return the better score
  //     return scoreWithEventDate.confidenceScore > scoreWithDebitDate.confidenceScore
  //       ? scoreWithEventDate
  //       : scoreWithDebitDate;
  //   }

  //   return scoreWithEventDate;
  // }

  // For specific document types, use the appropriate date
  const transactionDate = selectTransactionDate(aggregatedTransaction, aggregatedDocument.type);

  return calculateScoreWithDate(
    aggregatedTransaction,
    aggregatedDocument,
    transactionDate,
    docCharge.chargeId,
  );
}

/**
 * Helper function to calculate match score with a specific transaction date
 * @param transaction - Aggregated transaction
 * @param document - Aggregated document
 * @param transactionDate - Date to use from transaction
 * @param chargeId - Document charge ID
 * @returns Match score
 */
function calculateScoreWithDate(
  transaction: Omit<AggregatedTransaction, 'debitDate'>,
  document: Omit<AggregatedDocument, 'businessIsCreditor'>,
  transactionDate: Date,
  chargeId: string,
): MatchScore {
  // Calculate individual confidence scores
  const amountScore = calculateAmountConfidence(transaction.amount, document.amount);
  const currencyScore = calculateCurrencyConfidence(transaction.currency, document.currency);
  const businessScore = calculateBusinessConfidence(transaction.businessId, document.businessId);
  const dateScore = calculateDateConfidence(transactionDate, document.date);

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
