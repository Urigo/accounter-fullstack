/**
 * Factory exports for test fixtures
 *
 * This module provides a centralized export point for all factory functions
 * used to create test data objects.
 *
 * @module factories
 *
 * @example
 * ```typescript
 * import {
 *   createBusiness,
 *   createCharge,
 *   createTransaction,
 *   createDocument,
 *   makeUUID,
 *   formatNumeric,
 * } from '../factories';
 *
 * // Create a complete charge scenario
 * const businessId = makeUUID('supplier-1');
 * const business = createBusiness({ id: businessId });
 * const charge = createCharge({ owner_id: businessId });
 * const transaction = createTransaction({
 *   charge_id: charge.id!,
 *   business_id: businessId,
 *   amount: '-100.00',
 *   currency: 'ILS',
 *   event_date: '2024-01-15',
 * });
 * ```
 */

// Core data factories
export { createBusiness } from './business.js';
export type { IInsertBusinessesParams } from '@modules/financial-entities/__generated__/businesses.types.js';

export { createTaxCategory } from './tax-category.js';
export type { IInsertTaxCategoryParams } from '@modules/financial-entities/__generated__/tax-categories.types.js';

export { createFinancialAccount, FINANCIAL_ACCOUNT_TYPES } from './financial-account.js';
export type { IInsertFinancialAccountsParams } from '@modules/financial-accounts/__generated__/financial-accounts.types.js';

export { createCharge } from './charge.js';
export type { ChargeInsertParams } from './charge.js';

export { createTransaction } from './transaction.js';
export type { TransactionInsertParams } from './transaction.js';

export { createDocument } from './document.js';
export type { DocumentInsertParams } from './document.js';

// Helper utilities
export { makeUUID } from './ids.js';
export { iso, isoToday, addDays } from './dates.js';
export { formatNumeric, formatMoney, formatDecimal, parseNumeric } from './money.js';
