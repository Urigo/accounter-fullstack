/**
 * Fixture type definitions for test data scenarios
 *
 * These interfaces define the structure of test fixtures used to seed
 * database state for integration tests. Each fixture represents a complete
 * scenario with all related entities (businesses, charges, transactions, documents, etc.).
 *
 * **Type Independence**: These types are decoupled from pgtyped-generated database types
 * to maintain test independence and flexibility. Fixtures define their own minimal interfaces
 * that are converted to database-specific structures by the fixture-loader.
 *
 * @see packages/server/src/__tests__/helpers/fixture-validation.ts for validation logic
 * @see packages/server/src/__tests__/helpers/fixture-loader.ts for insertion logic
 */

import type { ChargeInsertParams } from '../factories/charge.js';
import type { TransactionInsertParams } from '../factories/transaction.js';
import type { DocumentInsertParams } from '../factories/document.js';
import type { financial_account_type } from '../../modules/transactions/types.js';

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
  businesses: Array<{
    id: string,
    name: string,
    hebrewName?: string | null,
    address?: string | null,
    email?: string | null,
    website?: string | null,
    phoneNumber?: string | null,
    governmentId?: string | null,
    exemptDealer?: boolean | null,
    suggestions?: object | null,
    optionalVat?: boolean | null,
    country?: string | null,
    pcn874RecordTypeOverride?: unknown | null,
    isReceiptEnough?: boolean | null,
    isDocumentsOptional?: boolean | null;
  }>;
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
  taxCategories: Array<{
    id: string;
    name: string;
    hashavshevetName?: string | null;
    taxExcluded?: boolean | null;
  }>;
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
  accounts: Array<{
      accountNumber?: string | null,
      name?: string | null,
      privateBusiness?: string | null,
      ownerId?: string | null,
      type?: financial_account_type | null}>;
}

/**
 * Financial account tax category mappings
 *
 * Maps financial accounts to tax categories for specific currencies.
 * Required for ledger generation to identify the tax category for each transaction.
 */
export interface FinancialAccountTaxCategoryMapping {
  /**
   * Account number (will be resolved to account ID during insertion)
   */
  accountNumber: string;

  /**
   * Currency code (ILS, USD, EUR, etc.)
   */
  currency: string;

  /**
   * Tax category ID to use for this account + currency combination
   */
  taxCategoryId: string;
}

/**
 * Financial account tax category mappings in a fixture
 */
export interface FixtureAccountTaxCategories {
  /**
   * Array of account-currency-tax_category mappings
   *
   * Each mapping assigns a tax category to a financial account for a specific currency.
   */
  mappings: FinancialAccountTaxCategoryMapping[];
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
  debitEntities?: string[];

  /**
   * Expected credit entities (financial entity IDs)
   */
  creditEntities?: string[];

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

  /**
   * Foreign currency code (if transaction is in foreign currency)
   */
  foreignCurrency?: string;

  /**
   * Foreign currency amount (before conversion to local currency)
   */
  foreignAmount?: number;

  /**
   * Exchange rate used for conversion (foreign → local)
   */
  exchangeRate?: number;
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
 *       createBusiness({ id: makeUUID('business', 'supplier-1'), hebrewName: 'Local Supplier Ltd' }),
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
 *         charge_id: makeUUID('charge', 'charge-1'),
 *         business_id: makeUUID('business', 'supplier-1'),
 *         amount: '-1000.00',
 *         currency: 'ILS',
 *         event_date: '2024-01-15',
 *       }),
 *     ],
 *   },
 *   documents: {
 *     documents: [
 *       createDocument({
 *         charge_id: makeUUID('charge', 'charge-1'),
 *         creditor_id: makeUUID('business', 'supplier-1'),
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
 *         chargeId: makeUUID('charge', 'charge-1'),
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
   * Financial account tax category mappings in this fixture
   */
  accountTaxCategories?: FixtureAccountTaxCategories;

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
