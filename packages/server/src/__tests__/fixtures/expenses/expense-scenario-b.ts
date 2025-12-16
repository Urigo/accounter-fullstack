/**
 * Expense Scenario B: Foreign Currency (USD) Invoice Expense
 *
 * This scenario represents an expense paid in foreign currency (USD) with an invoice.
 * It demonstrates foreign currency handling and exchange rate conversion in ledger generation.
 *
 * Flow:
 * 1. Admin business purchases from US Vendor LLC
 * 2. Transaction recorded: -200 USD (negative = expense/outflow)
 * 3. Invoice document provided in USD
 * 4. Expected ledger: debit expense category (in ILS), credit bank account (in ILS)
 *    - Exchange rate: 3.5 ILS per USD (mocked/deterministic)
 *    - 200 USD × 3.5 = 700 ILS total
 *
 * Prerequisites:
 * - Admin business entity exists (from seed)
 * - General expense tax category exists (from seed)
 * - Exchange rate mocked: USD→ILS at 3.5
 */

import {
  createBusiness,
  createCharge,
  createDocument,
  createTransaction,
  createTaxCategory,
  createFinancialAccount,
} from '../../factories';
import { makeUUID } from '../../../demo-fixtures/helpers/deterministic-uuid.js';
import type { Fixture } from '../../helpers/fixture-types';
import { CountryCode, Currency } from '../../../shared/enums.js';

/**
 * Expense Scenario B: USD Invoice Expense
 *
 * @description
 * A US supplier provides a service, admin pays 200 USD, receives an invoice.
 * This tests foreign currency conversion with a deterministic exchange rate.
 *
 * @example
 * ```typescript
 * import { expenseScenarioB } from './fixtures/expenses/expense-scenario-b';
 * import { insertFixture } from './helpers/fixture-loader';
 * import { mockExchangeRate } from './helpers/exchange-mock';
 * import { Currency } from '../../../shared/enums.js';
 *
 * await withTestTransaction(pool, async (client) => {
 *   await seedAdminCore(client); // Ensure admin context exists
 *   const idMap = await insertFixture(client, expenseScenarioB);
 *
 *   // Create context with mocked exchange rate
 *   const context = createLedgerTestContext({
 *     pool,
 *     adminContext,
 *     mockExchangeRates: mockExchangeRate(Currency.Usd, Currency.Ils, 3.5),
 *   });
 *
 *   // Now test ledger generation with foreign currency
 *   const chargeId = idMap.get('charge-consulting-services');
 *   // ... trigger ledger generation and assert
 * });
 * ```
 */
export const expenseScenarioB: Fixture = {
  businesses: {
    businesses: [
      // Admin business (owner of the expense)
      createBusiness({
        id: makeUUID('business', 'admin-business-usd'),
        name: 'Accounter Admin',
        country: CountryCode.Israel,
      }),
      // US Supplier business
      createBusiness({
        id: makeUUID('business', 'supplier-us-vendor-llc'),
        name: 'Supplier US Vendor LLC',
        country: CountryCode['United States of America (the)'],
        exemptDealer: false,
        isReceiptEnough: false, // Requires invoice for foreign transactions
      }),
    ],
  },

  taxCategories: {
    taxCategories: [
      createTaxCategory({
        id: makeUUID('tax-category', 'expense-consulting'),
        name: 'Consulting Expenses',
      }),
      createTaxCategory({
        id: makeUUID('tax-category', 'usd-account-tax-category'),
        name: 'Foreign Currency Account',
      }),
    ],
  },

  accounts: {
    accounts: [
      createFinancialAccount({
        accountNumber: 'USD-ACCOUNT-001',
        type: 'BANK_ACCOUNT',
        ownerId: makeUUID('business', 'admin-business-usd'),
      }),
    ],
  },

  accountTaxCategories: {
    mappings: [
      {
        accountNumber: 'USD-ACCOUNT-001',
          currency: Currency.Usd,
        taxCategoryId: makeUUID('tax-category', 'usd-account-tax-category'),
      },
    ],
  },

  charges: {
    charges: [
      createCharge(
        {
          owner_id: makeUUID('business', 'admin-business-usd'),
          tax_category_id: makeUUID('tax-category', 'expense-consulting'),
          user_description: 'Consulting services from US vendor',
        },
        {
          id: makeUUID('charge', 'charge-consulting-services'),
        },
      ),
    ],
  },

  transactions: {
    transactions: [
      createTransaction(
        {
          charge_id: makeUUID('charge', 'charge-consulting-services'),
          business_id: makeUUID('business', 'supplier-us-vendor-llc'),
          amount: '-200.00', // Negative = expense/outflow in USD
            currency: Currency.Usd,
          event_date: '2024-01-20',
          is_fee: false,
        },
        {
          id: makeUUID('transaction', 'transaction-consulting-payment'),
          account_id: 'USD-ACCOUNT-001', // Will be resolved to UUID by loader
          source_description: 'Consulting services - US Vendor LLC',
          debit_date: '2024-01-20',
          current_balance: '0', // Placeholder
        },
      ),
    ],
  },

  documents: {
    documents: [
      createDocument(
        {
          charge_id: makeUUID('charge', 'charge-consulting-services'),
          creditor_id: makeUUID('business', 'supplier-us-vendor-llc'), // Supplier is creditor
          debtor_id: makeUUID('business', 'admin-business-usd'), // Admin is debtor
          type: 'INVOICE',
          total_amount: 200.0, // Amount in USD
            currency_code: Currency.Usd,
          date: '2024-01-20', // Invoice date matches transaction
        },
        {
          id: makeUUID('document', 'document-consulting-invoice'),
          serial_number: 'INV-US-2024-001',
          vat_amount: null, // US invoice - no Israeli VAT
        },
      ),
    ],
  },

  expectations: {
    ledger: [
      {
        chargeId: makeUUID('charge', 'charge-consulting-services'),
        recordCount: 2, // Document + transaction entries
        debitEntities: [makeUUID('tax-category', 'expense-consulting'), makeUUID('tax-category', 'usd-account-tax-category')],
        creditEntities: [makeUUID('tax-category', 'usd-account-tax-category'), makeUUID('business', 'supplier-us-vendor-llc')],
        // Ledger processes document (700 ILS) + transaction (700 ILS) = 1400 ILS total
        // With exchange rate of 3.5 ILS/USD: 200 USD × 3.5 = 700 ILS per entry
        totalDebitLocal: 1400.0,
        totalCreditLocal: 1400.0,
        balanced: true,
          foreignCurrency: Currency.Usd,
        foreignAmount: 200.0,
        exchangeRate: 3.5, // Mocked deterministic rate
      },
    ],
  },
};
