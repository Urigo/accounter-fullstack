/**
 * Transaction factory for test fixtures
 *
 * Creates minimal transaction objects ready for database insertion.
 *
 * Based on transactions table schema from migrations:
 * - Required: account_id, charge_id, source_id, currency, event_date, amount, current_balance
 * - Optional: source_description, debit_date, business_id, is_fee, and other extended fields
 *
 * @see packages/migrations/src/actions/2024-01-29T13-15-23.initial.ts (transactions table)
 */

import { makeUUID, makeUUIDLegacy } from '../../demo-fixtures/helpers/deterministic-uuid.js';
import { formatNumeric } from './money.js';

/**
 * Transaction insert parameters shape
 *
 * Matches transactions table schema:
 * - Numeric fields (amount, current_balance) use string type for PostgreSQL numeric
 * - Dates are ISO strings
 * - currency is typed as string enum in database
 */
export interface TransactionInsertParams {
  id?: string;
  account_id: string;
  charge_id: string;
  source_id: string;
  source_description?: string | null;
  currency: string;
  event_date: string;
  debit_date?: string | null;
  amount: string; // PostgreSQL numeric -> string
  current_balance?: string; // PostgreSQL numeric -> string
  business_id?: string | null;
  is_fee?: boolean | null;
  currency_rate?: number | null;
}

/**
 * Create a transaction for test fixtures
 *
 * @param params - Required transaction fields
 * @param overrides - Optional overrides for any transaction field
 * @returns Transaction object ready for database insertion
 *
 * @remarks
 * - charge_id is required (links transaction to a charge)
 * - business_id is required (identifies counterparty for ledger)
 * - amount is required and must be string for PostgreSQL numeric
 * - currency is required (e.g., 'ILS', 'USD', 'EUR')
 * - event_date is required (transaction date)
 * - is_fee defaults to false (regular transaction, not a fee)
 * - currency_rate defaults to null (foreign currency transactions can specify exchange rate)
 * - account_id defaults to deterministic UUID if not provided
 * - source_id defaults to deterministic UUID (raw transaction reference)
 * - source_description defaults to null
 * - debit_date defaults to null (same as event_date in most cases)
 * - current_balance defaults to '0' (balance after transaction)
 * - id defaults to deterministic UUID if not provided
 *
 * @example
 * ```typescript
 * // Minimal transaction with required fields
 * const transaction = createTransaction({
 *   charge_id: makeUUID('charge', 'charge-1'),
 *   business_id: makeUUID('business', 'supplier-1'),
 *   amount: '-100.50',
 *   currency: 'ILS',
 *   event_date: '2024-01-15',
 * });
 *
 * // Transaction with optional is_fee flag
 * const feeTransaction = createTransaction({
 *   charge_id: makeUUID('charge', 'charge-1'),
 *   business_id: makeUUID('business', 'bank'),
 *   amount: '-5.00',
 *   currency: 'USD',
 *   event_date: '2024-01-15',
 *   is_fee: true,
 * });
 *
 * // Transaction with full overrides
 * const customTransaction = createTransaction(
 *   {
 *     charge_id: makeUUID('charge', 'charge-1'),
 *     business_id: makeUUID('business', 'supplier-1'),
 *     amount: '500.00',
 *     currency: 'EUR',
 *     event_date: '2024-03-10',
 *   },
 *   {
 *     account_id: makeUUID('account', 'eur-account'),
 *     source_description: 'Invoice payment EUR',
 *     debit_date: '2024-03-12',
 *     current_balance: '15000.00',
 *   }
 * );
 * ```
 */
export function createTransaction(
  params: {
    charge_id: string;
    business_id: string;
    amount: string | number;
    currency: string;
    event_date: string | Date;
    is_fee?: boolean;
  },
  overrides?: Partial<TransactionInsertParams>,
): TransactionInsertParams {
  return {
    id: makeUUIDLegacy(),
    account_id: makeUUID('account', 'default-account'),
    charge_id: params.charge_id,
    source_id: makeUUID('transaction-source', 'source-raw-tx'),
    source_description: null,
    currency: params.currency,
    event_date:
      typeof params.event_date === 'string'
        ? params.event_date
        : params.event_date.toISOString().slice(0, 10),
    debit_date: null,
    amount: typeof params.amount === 'string' ? params.amount : formatNumeric(params.amount),
    current_balance: '0',
    business_id: params.business_id,
    is_fee: params.is_fee ?? false,
    ...overrides,
  };
}
