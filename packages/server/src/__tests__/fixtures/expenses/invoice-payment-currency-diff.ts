/**
 * Invoice/Payment Currency Difference Scenarios
 *
 * All three fixtures below describe the same real-world shape: a vendor issues an invoice, and
 * it is settled from a different account on a later date. The charge carries
 * `invoice_payment_currency_diff = true`, which tells the ledger generation that the invoice
 * currency and the payment currency are deliberately different, so the business' foreign
 * currency positions have to be closed against the local currency rather than against each
 * other.
 *
 * They differ only in which of the two legs is foreign, which is exactly what splits the
 * branches of `multipleForeignCurrenciesBalanceEntries`:
 *
 * - {@link currencyDiffForeignInvoiceScenario}: EUR invoice, USD payment → the business holds
 *   *two* foreign positions (EUR + USD), so the multi-currency branch runs.
 * - {@link currencyDiffLocalInvoiceScenario}: ILS invoice, USD payment → the business holds a
 *   *single* foreign position (USD), so the single-currency branch runs.
 * - {@link currencyDiffLocalPaymentScenario}: EUR invoice, ILS payment → the mirror image, a
 *   single foreign position on the invoice side instead of the payment side.
 *
 * Exchange rates are mocked deterministically: USD→ILS at 3.0 and EUR→ILS at 3.5.
 */

import { makeUUID } from '../../../demo-fixtures/helpers/deterministic-uuid.js';
import { CountryCode, Currency } from '../../../shared/enums.js';
import {
  createBusiness,
  createCharge,
  createDocument,
  createFinancialAccount,
  createTaxCategory,
  createTransaction,
} from '../../factories';
import type { Fixture } from '../../helpers/fixture-types';

/** Mocked exchange rates shared by every scenario (and by the tests asserting on them). */
export const CURRENCY_DIFF_USD_RATE = 3.0;
export const CURRENCY_DIFF_EUR_RATE = 3.5;

/* -------------------------------------------------------------------------------------------
 * Scenario 1: EUR invoice paid from a USD account (two foreign currencies)
 * ---------------------------------------------------------------------------------------- */

const FOREIGN_ADMIN_ID = makeUUID('business', 'admin-business-currency-diff-foreign');
const FOREIGN_VENDOR_ID = makeUUID('business', 'vendor-eur-api-provider');
const FOREIGN_EXPENSE_TAX_CATEGORY_ID = makeUUID('tax-category', 'currency-diff-foreign-expense');
const FOREIGN_ACCOUNT_TAX_CATEGORY_ID = makeUUID('tax-category', 'currency-diff-foreign-usd-card');

export const CURRENCY_DIFF_FOREIGN_INVOICE_IDS = {
  adminId: FOREIGN_ADMIN_ID,
  vendorId: FOREIGN_VENDOR_ID,
  expenseTaxCategoryId: FOREIGN_EXPENSE_TAX_CATEGORY_ID,
  accountTaxCategoryId: FOREIGN_ACCOUNT_TAX_CATEGORY_ID,
  chargeId: makeUUID('charge', 'charge-currency-diff-foreign-invoice'),
  transactionId: makeUUID('transaction', 'transaction-currency-diff-foreign-invoice'),
  documentId: makeUUID('document', 'document-currency-diff-foreign-invoice'),
  accountNumber: 'USD-CARD-CURRENCY-DIFF-FOREIGN',
} as const;

/**
 * EUR invoice (49.00 EUR, 2026-08-29) settled by a USD charge (-58.85 USD, value date
 * 2026-09-02) on a USD card account.
 *
 * At the mocked rates the two legs are worth different local amounts:
 * - invoice:  49.00 EUR × 3.5 = 171.50 ILS  (credited to the vendor)
 * - payment:  58.85 USD × 3.0 = 176.55 ILS  (debited from the vendor)
 *
 * so the vendor ends up 5.05 ILS short, which the ledger is expected to close with an
 * exchange-rate record — after the two "Foreign currency balance" records zero out the EUR and
 * USD positions.
 */
export const currencyDiffForeignInvoiceScenario: Fixture = {
  businesses: {
    businesses: [
      createBusiness({
        id: FOREIGN_ADMIN_ID,
        name: 'Currency Diff Admin (Foreign Invoice)',
        country: CountryCode.Israel,
      }),
      createBusiness({
        id: FOREIGN_VENDOR_ID,
        name: 'EUR API Provider',
        country: CountryCode.France,
        exemptDealer: false,
        isReceiptEnough: false,
      }),
    ],
  },

  taxCategories: {
    taxCategories: [
      createTaxCategory({
        id: FOREIGN_EXPENSE_TAX_CATEGORY_ID,
        name: 'Software Subscriptions',
        ownerId: FOREIGN_ADMIN_ID,
      }),
      createTaxCategory({
        id: FOREIGN_ACCOUNT_TAX_CATEGORY_ID,
        name: 'USD Card Account',
        ownerId: FOREIGN_ADMIN_ID,
      }),
    ],
  },

  accounts: {
    accounts: [
      createFinancialAccount({
        accountNumber: CURRENCY_DIFF_FOREIGN_INVOICE_IDS.accountNumber,
        type: 'BANK_ACCOUNT',
        ownerId: FOREIGN_ADMIN_ID,
      }),
    ],
  },

  accountTaxCategories: {
    mappings: [
      {
        accountNumber: CURRENCY_DIFF_FOREIGN_INVOICE_IDS.accountNumber,
        currency: Currency.Usd,
        taxCategoryId: FOREIGN_ACCOUNT_TAX_CATEGORY_ID,
        ownerId: FOREIGN_ADMIN_ID,
      },
    ],
  },

  charges: {
    charges: [
      createCharge(
        {
          owner_id: FOREIGN_ADMIN_ID,
          tax_category_id: FOREIGN_EXPENSE_TAX_CATEGORY_ID,
          user_description: 'API subscription invoiced in EUR, paid in USD',
        },
        {
          id: CURRENCY_DIFF_FOREIGN_INVOICE_IDS.chargeId,
          invoice_payment_currency_diff: true,
        },
      ),
    ],
  },

  transactions: {
    transactions: [
      createTransaction(
        {
          charge_id: CURRENCY_DIFF_FOREIGN_INVOICE_IDS.chargeId,
          business_id: FOREIGN_VENDOR_ID,
          amount: '-58.85',
          currency: Currency.Usd,
          event_date: '2026-08-28',
          is_fee: false,
          owner_id: FOREIGN_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_FOREIGN_INVOICE_IDS.transactionId,
          account_id: CURRENCY_DIFF_FOREIGN_INVOICE_IDS.accountNumber,
          source_description: 'API subscription - EUR API Provider',
          debit_date: '2026-09-02',
          current_balance: '0',
        },
      ),
    ],
  },

  documents: {
    documents: [
      createDocument(
        {
          charge_id: CURRENCY_DIFF_FOREIGN_INVOICE_IDS.chargeId,
          creditor_id: FOREIGN_VENDOR_ID,
          debtor_id: FOREIGN_ADMIN_ID,
          type: 'INVOICE',
          total_amount: 49.0,
          currency_code: Currency.Eur,
          date: '2026-08-29',
          owner_id: FOREIGN_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_FOREIGN_INVOICE_IDS.documentId,
          serial_number: 'INV-EUR-2026-0001',
          vat_amount: null,
        },
      ),
    ],
  },
};

/* -------------------------------------------------------------------------------------------
 * Scenario 2: ILS invoice paid from a USD account (single foreign currency)
 * ---------------------------------------------------------------------------------------- */

const LOCAL_ADMIN_ID = makeUUID('business', 'admin-business-currency-diff-local');
const LOCAL_VENDOR_ID = makeUUID('business', 'vendor-ils-billed-reseller');
const LOCAL_EXPENSE_TAX_CATEGORY_ID = makeUUID('tax-category', 'currency-diff-local-expense');
const LOCAL_ACCOUNT_TAX_CATEGORY_ID = makeUUID('tax-category', 'currency-diff-local-usd-card');

export const CURRENCY_DIFF_LOCAL_INVOICE_IDS = {
  adminId: LOCAL_ADMIN_ID,
  vendorId: LOCAL_VENDOR_ID,
  expenseTaxCategoryId: LOCAL_EXPENSE_TAX_CATEGORY_ID,
  accountTaxCategoryId: LOCAL_ACCOUNT_TAX_CATEGORY_ID,
  chargeId: makeUUID('charge', 'charge-currency-diff-local-invoice'),
  transactionId: makeUUID('transaction', 'transaction-currency-diff-local-invoice'),
  documentId: makeUUID('document', 'document-currency-diff-local-invoice'),
  accountNumber: 'USD-CARD-CURRENCY-DIFF-LOCAL',
} as const;

/**
 * ILS invoice (25.54 ILS, 2026-08-27) settled by a USD charge (-8.92 USD, value date
 * 2026-09-02) on a USD card account.
 *
 * At the mocked rate the payment is worth 8.92 USD × 3.0 = 26.76 ILS against a 25.54 ILS
 * invoice, so the vendor ends up 1.22 ILS over, closed by an exchange-rate record after the
 * single "Foreign currency balance" record zeroes out the USD position.
 */
export const currencyDiffLocalInvoiceScenario: Fixture = {
  businesses: {
    businesses: [
      createBusiness({
        id: LOCAL_ADMIN_ID,
        name: 'Currency Diff Admin (Local Invoice)',
        country: CountryCode.Israel,
      }),
      createBusiness({
        id: LOCAL_VENDOR_ID,
        name: 'ILS Billed Reseller',
        country: CountryCode.Israel,
        exemptDealer: false,
        isReceiptEnough: false,
      }),
    ],
  },

  taxCategories: {
    taxCategories: [
      createTaxCategory({
        id: LOCAL_EXPENSE_TAX_CATEGORY_ID,
        name: 'Software Subscriptions',
        ownerId: LOCAL_ADMIN_ID,
      }),
      createTaxCategory({
        id: LOCAL_ACCOUNT_TAX_CATEGORY_ID,
        name: 'USD Card Account',
        ownerId: LOCAL_ADMIN_ID,
      }),
    ],
  },

  accounts: {
    accounts: [
      createFinancialAccount({
        accountNumber: CURRENCY_DIFF_LOCAL_INVOICE_IDS.accountNumber,
        type: 'BANK_ACCOUNT',
        ownerId: LOCAL_ADMIN_ID,
      }),
    ],
  },

  accountTaxCategories: {
    mappings: [
      {
        accountNumber: CURRENCY_DIFF_LOCAL_INVOICE_IDS.accountNumber,
        currency: Currency.Usd,
        taxCategoryId: LOCAL_ACCOUNT_TAX_CATEGORY_ID,
        ownerId: LOCAL_ADMIN_ID,
      },
    ],
  },

  charges: {
    charges: [
      createCharge(
        {
          owner_id: LOCAL_ADMIN_ID,
          tax_category_id: LOCAL_EXPENSE_TAX_CATEGORY_ID,
          user_description: 'Monthly subscription invoiced in ILS, paid in USD',
        },
        {
          id: CURRENCY_DIFF_LOCAL_INVOICE_IDS.chargeId,
          invoice_payment_currency_diff: true,
        },
      ),
    ],
  },

  transactions: {
    transactions: [
      createTransaction(
        {
          charge_id: CURRENCY_DIFF_LOCAL_INVOICE_IDS.chargeId,
          business_id: LOCAL_VENDOR_ID,
          amount: '-8.92',
          currency: Currency.Usd,
          event_date: '2026-08-26',
          is_fee: false,
          owner_id: LOCAL_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_LOCAL_INVOICE_IDS.transactionId,
          account_id: CURRENCY_DIFF_LOCAL_INVOICE_IDS.accountNumber,
          source_description: 'Monthly subscription - ILS Billed Reseller',
          debit_date: '2026-09-02',
          current_balance: '0',
        },
      ),
    ],
  },

  documents: {
    documents: [
      createDocument(
        {
          charge_id: CURRENCY_DIFF_LOCAL_INVOICE_IDS.chargeId,
          creditor_id: LOCAL_VENDOR_ID,
          debtor_id: LOCAL_ADMIN_ID,
          type: 'INVOICE',
          total_amount: 25.54,
          currency_code: Currency.Ils,
          date: '2026-08-27',
          owner_id: LOCAL_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_LOCAL_INVOICE_IDS.documentId,
          serial_number: 'INV-ILS-2026-0001',
          vat_amount: 0,
        },
      ),
    ],
  },
};

/* -------------------------------------------------------------------------------------------
 * Scenario 3: EUR invoice paid from an ILS account (single foreign currency, invoice side)
 * ---------------------------------------------------------------------------------------- */

const LOCAL_PAYMENT_ADMIN_ID = makeUUID('business', 'admin-business-currency-diff-local-payment');
const LOCAL_PAYMENT_VENDOR_ID = makeUUID('business', 'vendor-eur-billed-agency');
const LOCAL_PAYMENT_EXPENSE_TAX_CATEGORY_ID = makeUUID(
  'tax-category',
  'currency-diff-local-payment-expense',
);
const LOCAL_PAYMENT_ACCOUNT_TAX_CATEGORY_ID = makeUUID(
  'tax-category',
  'currency-diff-local-payment-ils-account',
);

export const CURRENCY_DIFF_LOCAL_PAYMENT_IDS = {
  adminId: LOCAL_PAYMENT_ADMIN_ID,
  vendorId: LOCAL_PAYMENT_VENDOR_ID,
  expenseTaxCategoryId: LOCAL_PAYMENT_EXPENSE_TAX_CATEGORY_ID,
  accountTaxCategoryId: LOCAL_PAYMENT_ACCOUNT_TAX_CATEGORY_ID,
  chargeId: makeUUID('charge', 'charge-currency-diff-local-payment'),
  transactionId: makeUUID('transaction', 'transaction-currency-diff-local-payment'),
  documentId: makeUUID('document', 'document-currency-diff-local-payment'),
  accountNumber: 'ILS-ACCOUNT-CURRENCY-DIFF',
} as const;

/**
 * The mirror image of {@link currencyDiffLocalInvoiceScenario}: the foreign leg is the invoice
 * rather than the payment. A EUR invoice (49.00 EUR, 2026-08-29) is settled by an ILS bank
 * charge (-180.00 ILS, value date 2026-09-02).
 *
 * At the mocked rate the invoice is worth 49.00 EUR × 3.5 = 171.50 ILS against a 180.00 ILS
 * payment, so the vendor ends up 8.50 ILS short, closed by an exchange-rate record after the
 * single "Foreign currency balance" record zeroes out the EUR position.
 */
export const currencyDiffLocalPaymentScenario: Fixture = {
  businesses: {
    businesses: [
      createBusiness({
        id: LOCAL_PAYMENT_ADMIN_ID,
        name: 'Currency Diff Admin (Local Payment)',
        country: CountryCode.Israel,
      }),
      createBusiness({
        id: LOCAL_PAYMENT_VENDOR_ID,
        name: 'EUR Billed Agency',
        country: CountryCode.France,
        exemptDealer: false,
        isReceiptEnough: false,
      }),
    ],
  },

  taxCategories: {
    taxCategories: [
      createTaxCategory({
        id: LOCAL_PAYMENT_EXPENSE_TAX_CATEGORY_ID,
        name: 'Software Subscriptions',
        ownerId: LOCAL_PAYMENT_ADMIN_ID,
      }),
      createTaxCategory({
        id: LOCAL_PAYMENT_ACCOUNT_TAX_CATEGORY_ID,
        name: 'ILS Bank Account',
        ownerId: LOCAL_PAYMENT_ADMIN_ID,
      }),
    ],
  },

  accounts: {
    accounts: [
      createFinancialAccount({
        accountNumber: CURRENCY_DIFF_LOCAL_PAYMENT_IDS.accountNumber,
        type: 'BANK_ACCOUNT',
        ownerId: LOCAL_PAYMENT_ADMIN_ID,
      }),
    ],
  },

  accountTaxCategories: {
    mappings: [
      {
        accountNumber: CURRENCY_DIFF_LOCAL_PAYMENT_IDS.accountNumber,
        currency: Currency.Ils,
        taxCategoryId: LOCAL_PAYMENT_ACCOUNT_TAX_CATEGORY_ID,
        ownerId: LOCAL_PAYMENT_ADMIN_ID,
      },
    ],
  },

  charges: {
    charges: [
      createCharge(
        {
          owner_id: LOCAL_PAYMENT_ADMIN_ID,
          tax_category_id: LOCAL_PAYMENT_EXPENSE_TAX_CATEGORY_ID,
          user_description: 'Retainer invoiced in EUR, paid in ILS',
        },
        {
          id: CURRENCY_DIFF_LOCAL_PAYMENT_IDS.chargeId,
          invoice_payment_currency_diff: true,
        },
      ),
    ],
  },

  transactions: {
    transactions: [
      createTransaction(
        {
          charge_id: CURRENCY_DIFF_LOCAL_PAYMENT_IDS.chargeId,
          business_id: LOCAL_PAYMENT_VENDOR_ID,
          amount: '-180.00',
          currency: Currency.Ils,
          event_date: '2026-08-28',
          is_fee: false,
          owner_id: LOCAL_PAYMENT_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_LOCAL_PAYMENT_IDS.transactionId,
          account_id: CURRENCY_DIFF_LOCAL_PAYMENT_IDS.accountNumber,
          source_description: 'Retainer - EUR Billed Agency',
          debit_date: '2026-09-02',
          current_balance: '0',
        },
      ),
    ],
  },

  documents: {
    documents: [
      createDocument(
        {
          charge_id: CURRENCY_DIFF_LOCAL_PAYMENT_IDS.chargeId,
          creditor_id: LOCAL_PAYMENT_VENDOR_ID,
          debtor_id: LOCAL_PAYMENT_ADMIN_ID,
          type: 'INVOICE',
          total_amount: 49.0,
          currency_code: Currency.Eur,
          date: '2026-08-29',
          owner_id: LOCAL_PAYMENT_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_LOCAL_PAYMENT_IDS.documentId,
          serial_number: 'INV-EUR-2026-0002',
          vat_amount: null,
        },
      ),
    ],
  },
};
