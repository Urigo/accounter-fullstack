import type { LedgerRecord } from '../demo-fixtures/validators/types.js';
import type { financial_account_type } from '../modules/financial-accounts/types.js';
import type { CountryCode, Currency } from '../shared/enums.js';

/**
 * Tax Category Mapping for Financial Accounts
 */
export interface TaxCategoryMapping {
  taxCategoryId: string;
  currency: Currency;
}

/**
 * Business Entity Fixture
 */
export interface BusinessFixture {
  id: string;
  name: string;
  country: CountryCode;
  canSettleWithReceipt: boolean;
}

/**
 * Tax Category Fixture
 */
export interface TaxCategoryFixture {
  id: string;
  name: string;
}

/**
 * Financial Account Fixture
 */
export interface FinancialAccountFixture {
  id: string;
  accountNumber: string;
  type: financial_account_type; // 'BANK_ACCOUNT', 'CREDIT_CARD', etc.
  currency: Currency;
  taxCategoryMappings?: TaxCategoryMapping[];
}

/**
 * Charge Fixture
 */
export interface ChargeFixture {
  id: string;
  ownerId: string; // Supports {{ADMIN_BUSINESS_ID}} placeholder
  userDescription: string;
}

/**
 * Transaction Fixture
 */
export interface TransactionFixture {
  id: string;
  chargeId: string;
  businessId: string;
  amount: string; // Decimal as string for precision
  currency: Currency;
  eventDate: string; // ISO date string
  debitDate: string; // ISO date string
  accountNumber: string;
}

/**
 * Document Fixture
 */
export interface DocumentFixture {
  id: string;
  chargeId: string;
  creditorId: string;
  debtorId: string; // Supports {{ADMIN_BUSINESS_ID}} placeholder
  serialNumber: string;
  type: string; // 'INVOICE', 'RECEIPT', etc.
  date: string; // ISO date string
  totalAmount: string; // Decimal as string
  currencyCode: Currency;
}

/**
 * Tag Fixture (Optional)
 */
export interface TagFixture {
  id: string;
  name: string;
  description?: string;
}

/**
 * Fixture Collection for a Use-Case
 */
export interface FixtureSpec {
  businesses: BusinessFixture[];
  taxCategories: TaxCategoryFixture[];
  financialAccounts: FinancialAccountFixture[];
  charges: ChargeFixture[];
  transactions: TransactionFixture[];
  documents: DocumentFixture[];
  tags?: TagFixture[];
}

/**
 * Use-Case Metadata
 */
export interface UseCaseMetadata {
  author: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  volumeMultiplier?: number; // Optional: Create N instances (default 1)
}

/**
 * Ledger Expectations for Validation
 */
export interface UseCaseExpectations {
  ledgerRecordCount: number;
  totalDebitILS?: string; // Decimal as string
  totalCreditILS?: string; // Decimal as string
}

/**
 * Use-Case Category
 */
export type UseCaseCategory = 'expenses' | 'income' | 'equity' | 'payroll' | 'other';

/**
 * Complete Use-Case Specification
 */
export interface UseCaseSpec {
  id: string; // Unique slug: 'monthly-expense-foreign-currency'
  name: string; // Display name: 'Monthly Expense (Foreign Currency)'
  description: string; // Long-form explanation for docs
  category: UseCaseCategory;
  fixtures: FixtureSpec;
  metadata: UseCaseMetadata;
  expectations?: UseCaseExpectations;
}

/**
 * Fixture Collection for a Use-Case
 */
export interface ExtendedFixtureSpec {
  businesses: BusinessFixture[];
  taxCategories: TaxCategoryFixture[];
  financialAccounts: FinancialAccountFixture[];
  charges: ChargeFixture[];
  transactions: TransactionFixture[];
  documents: DocumentFixture[];
  meta?: {
    id: string;
    description?: string;
    version?: string;
    [key: string]: unknown;
  };
  tags?: TagFixture[];
  expectations?: UseCaseExpectations & { ledger?: LedgerRecord[] };
  placeholders?: Record<string, string>;
}
