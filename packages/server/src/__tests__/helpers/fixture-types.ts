/**
 * Fixture type definitions for test data scenarios
 *
 * These interfaces define the structure of test fixtures used to seed
 * database state for integration tests. Each fixture represents a complete
 * scenario with all related entities (businesses, charges, transactions, documents, etc.).
 *
 * @see packages/server/src/__tests__/helpers/fixture-validation.ts for validation logic
 * @see packages/server/src/__tests__/helpers/fixture-loader.ts for insertion logic
 */

import type { IInsertBusinessesParams } from '@modules/financial-entities/__generated__/businesses.types.js';
import type { IInsertTaxCategoryParams } from '@modules/financial-entities/__generated__/tax-categories.types.js';
import type { IInsertFinancialAccountsParams } from '@modules/financial-accounts/__generated__/financial-accounts.types.js';
import type { ChargeInsertParams } from '../factories/charge.js';
import type { TransactionInsertParams } from '../factories/transaction.js';
import type { DocumentInsertParams } from '../factories/document.js';

/**
 * Business entities in a fixture
 *
 * Businesses represent operating entities (suppliers, customers, authorities, etc.)
 * that participate in financial transactions.
 */
export interface FixtureBusinesses {
  /**
   * Array of business records to insert
   *
   * Each business must have a unique id. The id will be referenced by
   * charges (owner_id), transactions (business_id), and documents (creditor_id/debtor_id).
   */
  businesses: IInsertBusinessesParams['businesses'];
}

/**
 * Tax categories in a fixture
 *
 * Tax categories are used for ledger classification and reporting.
 */
export interface FixtureTaxCategories {
  /**
   * Array of tax category records to insert
   *
   * Each tax category must have a unique id. The id will be referenced by
   * charges (tax_category_id) and financial accounts.
   */
  taxCategories: IInsertTaxCategoryParams[];
}

/**
 * Financial accounts in a fixture
 *
 * Financial accounts represent bank accounts, credit cards, crypto wallets, etc.
 * They are the source of transaction records.
 */
export interface FixtureAccounts {
  /**
   * Array of financial account records to insert
   *
   * Each account must have a unique id. The id will be referenced by
   * transactions (account_id).
   */
  accounts: IInsertFinancialAccountsParams['bankAccounts'];
}

/**
 * Charges in a fixture
 *
 * Charges are the central aggregation point for transactions, documents, and ledger entries.
 */
export interface FixtureCharges {
  /**
   * Array of charge records to insert
   *
   * Each charge must have a unique id and valid owner_id (business).
   * The id will be referenced by transactions (charge_id), documents (charge_id),
   * and ledger records (charge_id).
   */
  charges: ChargeInsertParams[];
}

/**
 * Transactions in a fixture
 *
 * Transactions represent monetary movements from financial accounts.
 */
export interface FixtureTransactions {
  /**
   * Array of transaction records to insert
   *
   * Each transaction must reference:
   * - charge_id: must exist in charges array
   * - account_id: must exist in accounts array (or use default from factory)
   * - business_id: must exist in businesses array
   */
  transactions: TransactionInsertParams[];
}

/**
 * Documents in a fixture
 *
 * Documents represent invoices, receipts, and other financial documents.
 */
export interface FixtureDocuments {
  /**
   * Array of document records to insert
   *
   * Each document must reference:
   * - charge_id: must exist in charges array
   * - creditor_id: must exist in businesses array
   * - debtor_id: must exist in businesses array
   */
  documents: DocumentInsertParams[];
}

/**
 * Expected ledger entries for a fixture scenario
 *
 * Used to validate that ledger generation produces the expected results.
 */
export interface LedgerExpectation {
  /**
   * Charge ID this expectation is for
   */
  chargeId: string;

  /**
   * Expected number of ledger records
   */
  recordCount: number;

  /**
   * Expected debit entities (financial entity IDs)
   */
  debitEntities: string[];

  /**
   * Expected credit entities (financial entity IDs)
   */
  creditEntities: string[];

  /**
   * Expected total debit amount in local currency
   */
  totalDebitLocal?: number;

  /**
   * Expected total credit amount in local currency
   */
  totalCreditLocal?: number;

  /**
   * Whether ledger should be balanced (debit == credit)
   * @default true
   */
  balanced?: boolean;
}

/**
 * Complete fixture for a test scenario
 *
 * A fixture represents all data needed to seed a complete test scenario,
 * including entities, charges, transactions, documents, and expected outcomes.
 *
 * @example
 * ```typescript
 * const expenseScenarioA: Fixture = {
 *   businesses: {
 *     businesses: [
 *       createBusiness({ id: makeUUID('supplier-1'), hebrewName: 'Local Supplier Ltd' }),
 *     ],
 *   },
 *   charges: {
 *     charges: [
 *       createCharge({ owner_id: ADMIN_ID, tax_category_id: EXPENSE_TAX_ID }),
 *     ],
 *   },
 *   transactions: {
 *     transactions: [
 *       createTransaction({
 *         charge_id: makeUUID('charge-1'),
 *         business_id: makeUUID('supplier-1'),
 *         amount: '-1000.00',
 *         currency: 'ILS',
 *         event_date: '2024-01-15',
 *       }),
 *     ],
 *   },
 *   documents: {
 *     documents: [
 *       createDocument({
 *         charge_id: makeUUID('charge-1'),
 *         creditor_id: makeUUID('supplier-1'),
 *         debtor_id: ADMIN_ID,
 *         type: 'RECEIPT',
 *         total_amount: 1000.0,
 *         currency_code: 'ILS',
 *         date: '2024-01-15',
 *       }),
 *     ],
 *   },
 *   expectations: {
 *     ledger: [
 *       {
 *         chargeId: makeUUID('charge-1'),
 *         recordCount: 2,
 *         debitEntities: [EXPENSE_TAX_CATEGORY_ID],
 *         creditEntities: [BANK_TAX_CATEGORY_ID],
 *         balanced: true,
 *       },
 *     ],
 *   },
 * };
 * ```
 */
export interface Fixture {
  /**
   * Business entities in this fixture
   */
  businesses?: FixtureBusinesses;

  /**
   * Tax categories in this fixture
   */
  taxCategories?: FixtureTaxCategories;

  /**
   * Financial accounts in this fixture
   */
  accounts?: FixtureAccounts;

  /**
   * Charges in this fixture
   */
  charges?: FixtureCharges;

  /**
   * Transactions in this fixture
   */
  transactions?: FixtureTransactions;

  /**
   * Documents in this fixture
   */
  documents?: FixtureDocuments;

  /**
   * Expected outcomes for assertions
   */
  expectations?: {
    /**
     * Expected ledger entries per charge
     */
    ledger?: LedgerExpectation[];
  };
}
