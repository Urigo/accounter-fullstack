/**
 * Document factory for test fixtures
 *
 * Creates minimal document objects ready for database insertion.
 *
 * Based on documents table schema from migrations:
 * - Required: charge_id, creditor_id, debtor_id, type, total_amount, currency_code, date
 * - Optional: serial_number, vat_amount, image_url, file_url, and other metadata
 *
 * @see packages/migrations/src/actions/2024-01-29T13-15-23.initial.ts (documents table)
 * @see packages/server/src/modules/documents/providers/documents.provider.ts (insertDocuments query)
 */

import { makeUUID } from './ids.js';

/**
 * Document insert parameters shape
 *
 * Matches documents table schema:
 * - Numeric fields (total_amount, vat_amount) use number type (double precision in DB)
 * - Dates are Date objects or ISO strings
 * - currency_code is typed as string enum in database
 * - type is document type enum (INVOICE, RECEIPT, etc.)
 */
export interface DocumentInsertParams {
  id?: string;
  image_url?: string | null;
  file_url?: string | null;
  type: string;
  serial_number?: string | null;
  date: Date | string;
  total_amount: number;
  currency_code: string;
  vat_amount?: number | null;
  charge_id: string;
  debtor_id: string;
  creditor_id: string;
  vat_report_date_override?: Date | string | null;
  no_vat_amount?: number | string | null;
  allocation_number?: string | null;
  exchange_rate_override?: number | null;
  file_hash?: string | null;
}

/**
 * Create a document for test fixtures
 *
 * @param params - Required document fields
 * @param overrides - Optional overrides for any document field
 * @returns Document object ready for database insertion
 *
 * @remarks
 * - charge_id is required (links document to a charge)
 * - creditor_id is required (who receives money)
 * - debtor_id is required (who pays money)
 * - type is required (INVOICE, RECEIPT, INVOICE_RECEIPT, CREDIT_INVOICE, etc.)
 * - total_amount is required (document total amount, numeric/double precision)
 * - currency_code is required (e.g., 'ILS', 'USD', 'EUR')
 * - date is required (document date)
 * - serial_number defaults to null (document reference number)
 * - vat_amount defaults to null (will be calculated if needed)
 * - image_url defaults to null (scanned document image)
 * - file_url defaults to null (PDF or other file)
 * - id defaults to deterministic UUID if not provided
 *
 * @example
 * ```typescript
 * // Minimal invoice document
 * const invoice = createDocument({
 *   charge_id: makeUUID('charge-1'),
 *   creditor_id: makeUUID('supplier-1'),
 *   debtor_id: makeUUID('my-business'),
 *   type: 'INVOICE',
 *   total_amount: 1000.0,
 *   currency_code: 'ILS',
 *   date: '2024-01-15',
 * });
 *
 * // Receipt with VAT
 * const receipt = createDocument({
 *   charge_id: makeUUID('charge-2'),
 *   creditor_id: makeUUID('customer-1'),
 *   debtor_id: makeUUID('my-business'),
 *   type: 'RECEIPT',
 *   total_amount: 500.0,
 *   currency_code: 'USD',
 *   date: new Date('2024-02-20'),
 * }, {
 *   vat_amount: 85.47,
 *   serial_number: 'RCP-2024-001',
 * });
 *
 * // Invoice with full metadata
 * const detailedInvoice = createDocument(
 *   {
 *     charge_id: makeUUID('charge-3'),
 *     creditor_id: makeUUID('supplier-2'),
 *     debtor_id: makeUUID('my-business'),
 *     type: 'INVOICE',
 *     total_amount: 2500.0,
 *     currency_code: 'EUR',
 *     date: '2024-03-10',
 *   },
 *   {
 *     serial_number: 'INV-2024-0123',
 *     vat_amount: 427.35,
 *     file_url: 'https://storage.example.com/invoices/inv-123.pdf',
 *     exchange_rate_override: 3.85,
 *   }
 * );
 * ```
 */
export function createDocument(
  params: {
    charge_id: string;
    creditor_id: string;
    debtor_id: string;
    type: string;
    total_amount: number;
    currency_code: string;
    date: Date | string;
  },
  overrides?: Partial<DocumentInsertParams>,
): DocumentInsertParams {
  return {
    id: makeUUID(),
    image_url: null,
    file_url: null,
    type: params.type,
    serial_number: null,
    date: params.date,
    total_amount: params.total_amount,
    currency_code: params.currency_code,
    vat_amount: null,
    charge_id: params.charge_id,
    debtor_id: params.debtor_id,
    creditor_id: params.creditor_id,
    vat_report_date_override: null,
    no_vat_amount: null,
    allocation_number: null,
    exchange_rate_override: null,
    file_hash: null,
    ...overrides,
  };
}
