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

import type { ChargeInsertParams, TransactionInsertParams, DocumentInsertParams } from '../factories/index.js';
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
    city?: string | null,
    zipCode?: string | null,
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
    ownerId: string;
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
    ownerId: string;
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

  /**
   * Owner ID for this mapping (used for multi-tenant scenarios)
   */
  ownerId: string;
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
 * Misc expenses in a fixture
 *
 * A misc expense books an amount between two financial entities (a business or a tax category) on
 * a charge, without a document or a transaction: Dr `debtorId` / Cr `creditorId`.
 */
export interface FixtureMiscExpenses {
  expenses: Array<{
    id: string;
    /** Must exist in the charges array (or have been inserted by an earlier fixture) */
    chargeId: string;
    ownerId: string;
    /** PostgreSQL numeric: a positive amount; a negative one swaps the sides */
    amount: string;
    currency: string;
    creditorId: string;
    debtorId: string;
    description?: string | null;
    invoiceDate: string;
    /** A `timestamp without time zone`, e.g. `2024-01-20 00:00:00`; the ledger keeps its day */
    valueDate: string;
  }>;
}

/**
 * Exchange rates in a fixture: one `exchange_rates` row per date, ILS per unit of each currency
 *
 * The table is global (not tenant-scoped) and has one row per date, so a fixture row is upserted:
 * only the currencies it gives are written, over whatever the row already holds. Insert fixtures
 * in a test transaction that is rolled back, so the rates never outlive the test.
 */
export interface FixtureExchangeRates {
  rates: Array<{
    date: string;
    usd?: number;
    eur?: number;
    gbp?: number;
    cad?: number;
    jpy?: number;
    aud?: number;
    sek?: number;
  }>;
}

/**
 * Depreciation categories in a fixture
 *
 * The table is global (not tenant-scoped). A 0% category holds assets that are not depreciated.
 */
export interface FixtureDepreciationCategories {
  categories: Array<{
    id: string;
    name: string;
    /** Yearly rate, 0-100 */
    percentage: number;
  }>;
}

/**
 * Depreciation records (assets) in a fixture
 */
export interface FixtureDepreciationRecords {
  records: Array<{
    id: string;
    /** The charge that bought the asset */
    chargeId: string;
    ownerId: string;
    categoryId: string;
    /** PostgreSQL numeric, in `currency` (the local currency when `currency` is unset) */
    amount: string | null;
    currency?: string | null;
    /** The cost basis in the local currency, overriding the conversion of `amount` */
    localAmount?: string | null;
    activationDate: string;
    type?: 'RESEARCH_AND_DEVELOPMENT' | 'GENERAL_AND_MANAGEMENT' | 'MARKETING' | null;
    /**
     * The asset's cost account, for an asset bought on a charge with several assets; unset, it is
     * the tax category of the charge that bought it
     */
    assetTaxCategoryId?: string | null;
  }>;
}

/**
 * Depreciation disposals (sales, write-offs and cost refunds) in a fixture
 *
 * Stored as the API stores them: a cost refund of an asset recorded in a foreign currency holds
 * `originalAmount` in that currency and no `disposedCost`; any other event holds its local
 * `disposedCost`.
 */
export interface FixtureDepreciationDisposals {
  disposals: Array<{
    id: string;
    ownerId: string;
    /** Must exist in the depreciation records (of this fixture or an earlier one) */
    depreciationId: string;
    /** The charge carrying the money: a sale's proceeds or a cost refund */
    chargeId?: string | null;
    type: 'SALE' | 'WRITE_OFF' | 'COST_REFUND';
    /** Cost refunds only; unset (NULL) means `FROM_ACTIVATION` */
    refundMode?: 'FROM_ACTIVATION' | 'FROM_REFUND_DATE' | null;
    disposalDate: string;
    /** PostgreSQL numeric: the local cost of the event */
    disposedCost?: string | null;
    /** PostgreSQL numeric: a cost refund in the asset's foreign currency */
    originalAmount?: string | null;
    originalCurrency?: string | null;
    /** PostgreSQL numeric; defaults to 0 */
    proceeds?: string | null;
    description?: string | null;
  }>;
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

  /**
   * Owner ID for this ledger expectation (used for multi-tenant scenarios)
   */
  ownerId: string;
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
   * Misc expenses in this fixture
   */
  miscExpenses?: FixtureMiscExpenses;

  /**
   * Exchange rates in this fixture (global rows, upserted by date)
   */
  exchangeRates?: FixtureExchangeRates;

  /**
   * Depreciation categories in this fixture (global rows)
   */
  depreciationCategories?: FixtureDepreciationCategories;

  /**
   * Depreciation records (assets) in this fixture
   */
  depreciationRecords?: FixtureDepreciationRecords;

  /**
   * Depreciation disposals (sales, write-offs, cost refunds) in this fixture
   */
  depreciationDisposals?: FixtureDepreciationDisposals;

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
