/**
 * Transaction Aggregator
 *
 * Aggregates multiple transactions from a single charge into a unified representation
 * for matching purposes. Handles fee exclusion, currency validation, business ID
 * validation, amount summation, date selection, and description concatenation.
 */

import type { currency } from '../../transactions/types.js';
import type { AggregatedTransaction } from '../types.js';

/**
 * Minimal transaction interface for aggregation
 * Based on database schema from accounter_schema.transactions
 */
export interface Transaction {
  id: string; // UUID
  charge_id: string; // UUID
  amount: string; // numeric in DB
  currency: currency; // Currency type
  business_id: string | null; // UUID or null
  event_date: Date;
  debit_date: Date | null;
  debit_timestamp: Date | null;
  source_description: string | null;
  is_fee: boolean | null;
}

/**
 * Aggregate multiple transactions into a single representation
 *
 * Per specification (section 4.2):
 * 1. Exclude transactions where is_fee = true
 * 2. If multiple currencies exist: throw error
 * 3. If multiple non-null business IDs exist: throw error
 * 4. Amount: sum of all amounts
 * 5. Currency: the common currency
 * 6. Business ID: the single non-null business ID (or null if all null)
 * 7. Date: earliest event_date
 * 8. Description: concatenate all source_description values with line breaks
 *
 * @param transactions - Array of transactions from a charge
 * @returns Aggregated transaction data
 *
 * @throws {Error} If transactions array is empty
 * @throws {Error} If no non-fee transactions exist after filtering
 * @throws {Error} If multiple different currencies exist
 * @throws {Error} If multiple different non-null business IDs exist
 *
 * @example
 * const aggregated = aggregateTransactions([
 *   { amount: 100, currency: 'USD', business_id: 'b1', event_date: new Date('2024-01-15'), ... },
 *   { amount: 50, currency: 'USD', business_id: 'b1', event_date: new Date('2024-01-20'), ... }
 * ]);
 * // Returns: { amount: 150, currency: 'USD', businessId: 'b1', date: Date('2024-01-15'), ... }
 */
export function aggregateTransactions(transactions: Transaction[]): AggregatedTransaction {
  // Validate non-empty input
  if (!transactions || transactions.length === 0) {
    throw new Error('Cannot aggregate transactions: array is empty');
  }

  // Filter out fee transactions
  const nonFeeTransactions = transactions.filter(t => t.is_fee !== true);

  // Validate we have transactions after filtering
  if (nonFeeTransactions.length === 0) {
    throw new Error('Cannot aggregate transactions: all transactions are marked as fees');
  }

  // Validate single currency
  const currencies = new Set(nonFeeTransactions.map(t => t.currency));
  if (currencies.size > 1) {
    throw new Error(
      `Cannot aggregate transactions: multiple currencies found (${Array.from(currencies).join(', ')})`,
    );
  }

  // Validate single non-null business ID
  const businessIds = nonFeeTransactions
    .map(t => t.business_id)
    .filter((id): id is string => id !== null && id !== undefined);

  const uniqueBusinessIds = new Set(businessIds);
  if (uniqueBusinessIds.size > 1) {
    throw new Error(
      `Cannot aggregate transactions: multiple business IDs found (${Array.from(uniqueBusinessIds).join(', ')})`,
    );
  }

  // Sum amounts
  const totalAmount = nonFeeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

  // Get common currency (safe since we validated single currency)
  const currency = nonFeeTransactions[0].currency;

  // Get business ID (single non-null or null if all null)
  const businessId = uniqueBusinessIds.size === 1 ? Array.from(uniqueBusinessIds)[0] : null;

  // Get earliest event_date
  const earliestDate = nonFeeTransactions.reduce((earliest, t) => {
    return t.event_date < earliest ? t.event_date : earliest;
  }, nonFeeTransactions[0].event_date);

  // Get earliest debit_date
  const earliestDebitDate = nonFeeTransactions.reduce(
    (earliest, t) => {
      const debitDate = t.debit_timestamp ?? t.debit_date;
      if (debitDate === null) return earliest;
      if (earliest === null) return debitDate;
      return debitDate < earliest ? debitDate : earliest;
    },
    null as Date | null,
  );

  // Concatenate descriptions with line breaks, filtering out nulls
  const descriptions = nonFeeTransactions
    .map(t => t.source_description)
    .filter((desc): desc is string => desc !== null && desc !== undefined && desc.trim() !== '');

  const description = descriptions.length > 0 ? descriptions.join('\n') : '';

  return {
    amount: totalAmount,
    currency,
    businessId,
    date: earliestDate,
    description,
    debitDate: earliestDebitDate,
  };
}
