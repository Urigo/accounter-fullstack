/**
 * Expense Scenario A: Local Currency (ILS) Receipt Expense
 *
 * This scenario represents a simple expense paid in local currency (ILS) with a receipt.
 * It demonstrates the basic happy path for expense recording and ledger generation.
 *
 * Flow:
 * 1. Admin business purchases from Local Supplier Ltd
 * 2. Transaction recorded: -500 ILS (negative = expense/outflow)
 * 3. Receipt document provided matching the transaction
 * 4. Expected ledger: debit expense category, credit bank account
 *
 * Prerequisites:
 * - Admin business entity exists (from seed)
 * - General expense tax category exists (from seed)
 */

import { createBusiness, createCharge, createDocument, createTransaction, createTaxCategory } from '../../factories';
import { makeUUID } from '../../factories/ids';
import type { Fixture } from '../../helpers/fixture-types';

/**
 * Expense Scenario A: ILS Receipt Expense
 *
 * @description
 * A local supplier provides a service, admin pays 500 ILS, receives a receipt.
 * This is the simplest expense case with matching transaction and document.
 *
 * @example
 * ```typescript
 * import { expenseScenarioA } from './fixtures/expenses/expense-scenario-a';
 * import { insertFixture } from './helpers/fixture-loader';
 *
 * await withTestTransaction(pool, async (client) => {
 *   await seedAdminCore(client); // Ensure admin context exists
 *   const idMap = await insertFixture(client, expenseScenarioA);
 *
 *   // Now test ledger generation
 *   const chargeId = idMap.get('charge-office-supplies');
 *   // ... trigger ledger generation and assert
 * });
 * ```
 */
export const expenseScenarioA: Fixture = {
  businesses: {
    businesses: [
      // Admin business (owner of the expense)
      createBusiness({
        id: makeUUID('admin-business'),
        hebrewName: 'חשבונאות ניהול',
        country: 'ISR',
      }),
      // Supplier business
      createBusiness({
        id: makeUUID('supplier-local-ltd'),
        hebrewName: 'ספק מקומי בע"מ',
        country: 'ISR',
        exemptDealer: false,
        isReceiptEnough: true, // Can provide receipts for small purchases
      }),
    ],
  },

  taxCategories: {
    taxCategories: [
      createTaxCategory({
        id: makeUUID('expense-general'),
        hashavshevetName: 'General Expenses',
      }),
      createTaxCategory({
        id: makeUUID('bank-account-tax-category'),
        hashavshevetName: 'Bank Account',
      }),
    ],
  },

  accounts: {
    // Note: Financial accounts typically come from bank feeds or manual setup
    // For this scenario, we assume admin's bank account exists from prior setup
    // If needed for the test, create a minimal bank account here
    accounts: [],
  },

  charges: {
    charges: [
      createCharge(
        {
          owner_id: makeUUID('admin-business'),
          tax_category_id: makeUUID('expense-general'),
          user_description: 'Office supplies purchase',
        },
        {
          id: makeUUID('charge-office-supplies'),
        },
      ),
    ],
  },

  transactions: {
    transactions: [
      createTransaction(
        {
          charge_id: makeUUID('charge-office-supplies'),
          business_id: makeUUID('supplier-local-ltd'),
          amount: '-500.00', // Negative = expense/outflow
          currency: 'ILS',
          event_date: '2024-01-15',
          is_fee: false,
        },
        {
          id: makeUUID('transaction-supplies-payment'),
          account_id: 'BANK-ACCOUNT-001', // Will be resolved to UUID by loader
          source_description: 'Office supplies - Local Supplier Ltd',
          debit_date: '2024-01-15',
          current_balance: '0', // Placeholder - not critical for test
        },
      ),
    ],
  },

  documents: {
    documents: [
      createDocument(
        {
          charge_id: makeUUID('charge-office-supplies'),
          creditor_id: makeUUID('supplier-local-ltd'), // Supplier is creditor
          debtor_id: makeUUID('admin-business'), // Admin is debtor (owes money)
          type: 'RECEIPT',
          total_amount: 500.0, // Matches transaction amount (positive in document)
          currency_code: 'ILS',
          date: '2024-01-15', // Receipt date matches transaction
        },
        {
          id: makeUUID('document-supplies-receipt'),
          serial_number: 'RCP-2024-001',
          vat_amount: null, // For simplicity, no VAT breakdown on receipt
        },
      ),
    ],
  },

  expectations: {
    ledger: [
      {
        chargeId: makeUUID('charge-office-supplies'),
        recordCount: 2, // Debit expense + credit bank
        debitEntities: [makeUUID('expense-general')],
        creditEntities: [makeUUID('bank-account-tax-category')],
        totalDebitLocal: 500.0,
        totalCreditLocal: 500.0,
        balanced: true,
      },
    ],
  },
};
