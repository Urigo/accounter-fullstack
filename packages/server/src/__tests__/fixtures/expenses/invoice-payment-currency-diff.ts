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
 * Two further scenarios carry the same flag in less tidy shapes:
 *
 * - {@link currencyDiffBusinessTripScenario}: a business trip charge with five invoices across
 *   two currencies, reimbursed to the employee in one local-currency transfer.
 * - {@link currencyDiffMixedDocumentsScenario}: a local invoice sitting next to a foreign
 *   receipt and proforma for the same debt, settled in the foreign currency — only the invoice
 *   may reach the ledger.
 *
 * Exchange rates are mocked deterministically: USD→ILS at 3.0 and EUR→ILS at 3.5, except where
 * a scenario documents its own rate.
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

/* -------------------------------------------------------------------------------------------
 * Scenario 4: business trip charge — several foreign invoices reimbursed in local currency
 * ---------------------------------------------------------------------------------------- */

const TRIP_ADMIN_ID = makeUUID('business', 'admin-business-currency-diff-trip');
const TRIP_EMPLOYEE_ID = makeUUID('business', 'employee-currency-diff-trip');
const TRIP_EXPENSE_TAX_CATEGORY_ID = makeUUID('tax-category', 'currency-diff-trip-expense');
const TRIP_ACCOUNT_TAX_CATEGORY_ID = makeUUID('tax-category', 'currency-diff-trip-ils-account');

export const CURRENCY_DIFF_TRIP_IDS = {
  adminId: TRIP_ADMIN_ID,
  vendorId: TRIP_EMPLOYEE_ID,
  expenseTaxCategoryId: TRIP_EXPENSE_TAX_CATEGORY_ID,
  accountTaxCategoryId: TRIP_ACCOUNT_TAX_CATEGORY_ID,
  chargeId: makeUUID('charge', 'charge-currency-diff-trip'),
  transactionId: makeUUID('transaction', 'transaction-currency-diff-trip'),
  documentId: makeUUID('document', 'document-currency-diff-trip-usd-1'),
  accountNumber: 'ILS-ACCOUNT-CURRENCY-DIFF-TRIP',
  tripId: makeUUID('business-trip', 'currency-diff-trip'),
  tripExpenseId: makeUUID('business-trip-expense', 'currency-diff-trip-reimbursement'),
  documentIds: {
    usd1: makeUUID('document', 'document-currency-diff-trip-usd-1'),
    usd2: makeUUID('document', 'document-currency-diff-trip-usd-2'),
    usd3: makeUUID('document', 'document-currency-diff-trip-usd-3'),
    usd4: makeUUID('document', 'document-currency-diff-trip-usd-4'),
    ils: makeUUID('document', 'document-currency-diff-trip-ils'),
  },
} as const;

/**
 * A business trip charge: an employee fronts five expenses over the trip and is reimbursed in
 * one local-currency transfer months later.
 *
 * Four of the invoices are in USD (35.45 + 6.72 + 7.55 + 12.22 = 61.94 USD → 185.82 ILS at the
 * mocked rate) and one is in ILS (150.40), so the employee is owed 336.22 ILS. The
 * reimbursement is 360.00 ILS, which leaves 23.78 ILS to be absorbed.
 *
 * The real charge also carried a small bank fee transaction. It is left out here: a fee leg
 * needs the paying bank registered as an internal wallet in the admin context, and it is a
 * self-contained two-sided entry that does not touch the balancing under test.
 */
export const currencyDiffBusinessTripScenario: Fixture = {
  businesses: {
    businesses: [
      createBusiness({
        id: TRIP_ADMIN_ID,
        name: 'Currency Diff Admin (Business Trip)',
        country: CountryCode.Israel,
      }),
      createBusiness({
        id: TRIP_EMPLOYEE_ID,
        name: 'Trip Employee',
        country: CountryCode.Israel,
      }),
    ],
  },

  taxCategories: {
    taxCategories: [
      createTaxCategory({
        id: TRIP_EXPENSE_TAX_CATEGORY_ID,
        name: 'R&D Business Trip',
        ownerId: TRIP_ADMIN_ID,
      }),
      createTaxCategory({
        id: TRIP_ACCOUNT_TAX_CATEGORY_ID,
        name: 'ILS Bank Account (Trip)',
        ownerId: TRIP_ADMIN_ID,
      }),
    ],
  },

  accounts: {
    accounts: [
      createFinancialAccount({
        accountNumber: CURRENCY_DIFF_TRIP_IDS.accountNumber,
        type: 'BANK_ACCOUNT',
        ownerId: TRIP_ADMIN_ID,
      }),
    ],
  },

  accountTaxCategories: {
    mappings: [
      {
        accountNumber: CURRENCY_DIFF_TRIP_IDS.accountNumber,
        currency: Currency.Ils,
        taxCategoryId: TRIP_ACCOUNT_TAX_CATEGORY_ID,
        ownerId: TRIP_ADMIN_ID,
      },
    ],
  },

  charges: {
    charges: [
      createCharge(
        {
          owner_id: TRIP_ADMIN_ID,
          tax_category_id: TRIP_EXPENSE_TAX_CATEGORY_ID,
          user_description: 'Business trip expenses reimbursement',
        },
        {
          id: CURRENCY_DIFF_TRIP_IDS.chargeId,
          type: 'BUSINESS_TRIP',
          invoice_payment_currency_diff: true,
        },
      ),
    ],
  },

  businessTrips: {
    trips: [
      {
        id: CURRENCY_DIFF_TRIP_IDS.tripId,
        name: 'Currency Diff Test Trip',
        tripPurpose: 'R&D conference',
        ownerId: TRIP_ADMIN_ID,
      },
    ],
    chargeLinks: [
      {
        businessTripId: CURRENCY_DIFF_TRIP_IDS.tripId,
        chargeId: CURRENCY_DIFF_TRIP_IDS.chargeId,
        ownerId: TRIP_ADMIN_ID,
      },
    ],
    expenses: [
      {
        id: CURRENCY_DIFF_TRIP_IDS.tripExpenseId,
        businessTripId: CURRENCY_DIFF_TRIP_IDS.tripId,
        category: 'OTHER',
        description: 'Employee expenses reimbursement',
        ownerId: TRIP_ADMIN_ID,
      },
    ],
    // Ledger generation rejects a trip transaction that is not matched to an expense, and one
    // whose matches do not add up to the transaction amount.
    transactionMatches: [
      {
        businessTripExpenseId: CURRENCY_DIFF_TRIP_IDS.tripExpenseId,
        transactionId: CURRENCY_DIFF_TRIP_IDS.transactionId,
        amount: '-360.00',
        ownerId: TRIP_ADMIN_ID,
      },
    ],
  },

  transactions: {
    transactions: [
      createTransaction(
        {
          charge_id: CURRENCY_DIFF_TRIP_IDS.chargeId,
          business_id: TRIP_EMPLOYEE_ID,
          amount: '-360.00',
          currency: Currency.Ils,
          event_date: '2022-08-08',
          is_fee: false,
          owner_id: TRIP_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_TRIP_IDS.transactionId,
          account_id: CURRENCY_DIFF_TRIP_IDS.accountNumber,
          source_description: 'Business trip expenses transfer',
          debit_date: '2022-08-08',
          current_balance: '0',
        },
      ),
    ],
  },

  documents: {
    documents: [
      ...(
        [
          ['usd1', 35.45, '2022-06-01', 'TRIP-USD-0001'],
          ['usd2', 6.72, '2022-06-03', 'TRIP-USD-0002'],
          ['usd3', 7.55, '2022-06-03', 'TRIP-USD-0003'],
          ['usd4', 12.22, '2022-06-05', 'TRIP-USD-0004'],
        ] as const
      ).map(([key, amount, date, serial]) =>
        createDocument(
          {
            charge_id: CURRENCY_DIFF_TRIP_IDS.chargeId,
            creditor_id: TRIP_EMPLOYEE_ID,
            debtor_id: TRIP_ADMIN_ID,
            type: 'INVOICE_RECEIPT',
            total_amount: amount,
            currency_code: Currency.Usd,
            date,
            owner_id: TRIP_ADMIN_ID,
          },
          {
            id: CURRENCY_DIFF_TRIP_IDS.documentIds[key],
            serial_number: serial,
            vat_amount: null,
          },
        ),
      ),
      createDocument(
        {
          charge_id: CURRENCY_DIFF_TRIP_IDS.chargeId,
          creditor_id: TRIP_EMPLOYEE_ID,
          debtor_id: TRIP_ADMIN_ID,
          type: 'INVOICE_RECEIPT',
          total_amount: 150.4,
          currency_code: Currency.Ils,
          date: '2022-06-10',
          owner_id: TRIP_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_TRIP_IDS.documentIds.ils,
          serial_number: 'TRIP-ILS-0001',
          vat_amount: 0,
        },
      ),
    ],
  },
};

/* -------------------------------------------------------------------------------------------
 * Scenario 5: local invoice + foreign receipt, settled in the receipt's currency
 * ---------------------------------------------------------------------------------------- */

const MIXED_ADMIN_ID = makeUUID('business', 'admin-business-currency-diff-mixed');
const MIXED_VENDOR_ID = makeUUID('business', 'vendor-insurance-broker');
const MIXED_EXPENSE_TAX_CATEGORY_ID = makeUUID('tax-category', 'currency-diff-mixed-expense');
const MIXED_ACCOUNT_TAX_CATEGORY_ID = makeUUID('tax-category', 'currency-diff-mixed-usd-account');

/**
 * Scenario-specific USD rate. The other scenarios share a round 3.0; this one uses the rate the
 * real charge was settled at, so the 47.20 ILS difference below is the one the books show.
 */
export const CURRENCY_DIFF_MIXED_USD_RATE = 3.615;

export const CURRENCY_DIFF_MIXED_IDS = {
  adminId: MIXED_ADMIN_ID,
  vendorId: MIXED_VENDOR_ID,
  expenseTaxCategoryId: MIXED_EXPENSE_TAX_CATEGORY_ID,
  accountTaxCategoryId: MIXED_ACCOUNT_TAX_CATEGORY_ID,
  chargeId: makeUUID('charge', 'charge-currency-diff-mixed'),
  transactionId: makeUUID('transaction', 'transaction-currency-diff-mixed'),
  documentId: makeUUID('document', 'document-currency-diff-mixed-invoice'),
  accountNumber: 'USD-ACCOUNT-CURRENCY-DIFF-MIXED',
  /** Global reference rows this scenario adds, to be removed with it. */
  vatValueDates: ['2025-01-01'],
  documentIds: {
    invoice: makeUUID('document', 'document-currency-diff-mixed-invoice'),
    receipt: makeUUID('document', 'document-currency-diff-mixed-receipt'),
    proforma: makeUUID('document', 'document-currency-diff-mixed-proforma'),
  },
} as const;

/**
 * The charge carries three documents in two currencies, and only one of them belongs in the
 * ledger:
 *
 * - a tax invoice for 6,777.92 ILS (1,033.92 of it VAT), 2025-02-28 — the accounting document
 * - a receipt for 1,888.00 USD, 2025-03-10 — the same debt, in the currency it was paid in
 * - a proforma invoice for 1,600.00 USD, 2025-03-03 — an earlier quote
 *
 * Ledger generation must account for the invoice and ignore the other two, so the vendor is
 * credited 6,777.92 ILS and debited the 1,888.00 USD payment (6,825.12 ILS at the rate above),
 * leaving 47.20 ILS for the exchange-rate record. Taking the receipt instead would make the two
 * legs cancel out exactly and hide the difference.
 */
export const currencyDiffMixedDocumentsScenario: Fixture = {
  businesses: {
    businesses: [
      createBusiness({
        id: MIXED_ADMIN_ID,
        name: 'Currency Diff Admin (Mixed Documents)',
        country: CountryCode.Israel,
      }),
      createBusiness({
        id: MIXED_VENDOR_ID,
        name: 'Insurance Broker Ltd',
        country: CountryCode.Israel,
        exemptDealer: false,
        isReceiptEnough: false,
      }),
    ],
  },

  taxCategories: {
    taxCategories: [
      createTaxCategory({
        id: MIXED_EXPENSE_TAX_CATEGORY_ID,
        name: 'Business Insurance',
        ownerId: MIXED_ADMIN_ID,
      }),
      createTaxCategory({
        id: MIXED_ACCOUNT_TAX_CATEGORY_ID,
        name: 'USD Bank Account (Mixed)',
        ownerId: MIXED_ADMIN_ID,
      }),
    ],
  },

  accounts: {
    accounts: [
      createFinancialAccount({
        accountNumber: CURRENCY_DIFF_MIXED_IDS.accountNumber,
        type: 'BANK_ACCOUNT',
        ownerId: MIXED_ADMIN_ID,
      }),
    ],
  },

  accountTaxCategories: {
    mappings: [
      {
        accountNumber: CURRENCY_DIFF_MIXED_IDS.accountNumber,
        currency: Currency.Usd,
        taxCategoryId: MIXED_ACCOUNT_TAX_CATEGORY_ID,
        ownerId: MIXED_ADMIN_ID,
      },
    ],
  },

  // The invoice below carries VAT, which ledger generation only accepts when a rate covers the
  // document's date. Dated 2025-01-01 so it covers this fixture and nothing else.
  vatValues: {
    values: [{ date: '2025-01-01', percentage: 0.18 }],
  },

  charges: {
    charges: [
      createCharge(
        {
          owner_id: MIXED_ADMIN_ID,
          tax_category_id: MIXED_EXPENSE_TAX_CATEGORY_ID,
          user_description: 'Insurance premium invoiced in ILS, paid in USD',
        },
        {
          id: CURRENCY_DIFF_MIXED_IDS.chargeId,
          invoice_payment_currency_diff: true,
        },
      ),
    ],
  },

  transactions: {
    transactions: [
      createTransaction(
        {
          charge_id: CURRENCY_DIFF_MIXED_IDS.chargeId,
          business_id: MIXED_VENDOR_ID,
          amount: '-1888.00',
          currency: Currency.Usd,
          event_date: '2025-03-06',
          is_fee: false,
          owner_id: MIXED_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_MIXED_IDS.transactionId,
          account_id: CURRENCY_DIFF_MIXED_IDS.accountNumber,
          source_description: 'Insurance premium - Insurance Broker Ltd',
          debit_date: '2025-03-06',
          current_balance: '0',
        },
      ),
    ],
  },

  documents: {
    documents: [
      // The accounting document: local currency, carries the VAT.
      createDocument(
        {
          charge_id: CURRENCY_DIFF_MIXED_IDS.chargeId,
          creditor_id: MIXED_VENDOR_ID,
          debtor_id: MIXED_ADMIN_ID,
          type: 'INVOICE',
          total_amount: 6777.92,
          currency_code: Currency.Ils,
          date: '2025-02-28',
          owner_id: MIXED_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_MIXED_IDS.documentIds.invoice,
          serial_number: 'INV-ILS-2025-0001',
          vat_amount: 1033.92,
        },
      ),
      // Same debt, issued in the currency it was paid in. Must not reach the ledger.
      createDocument(
        {
          charge_id: CURRENCY_DIFF_MIXED_IDS.chargeId,
          creditor_id: MIXED_VENDOR_ID,
          debtor_id: MIXED_ADMIN_ID,
          type: 'RECEIPT',
          total_amount: 1888.0,
          currency_code: Currency.Usd,
          date: '2025-03-10',
          owner_id: MIXED_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_MIXED_IDS.documentIds.receipt,
          serial_number: 'RCP-USD-2025-0001',
          vat_amount: 288.0,
        },
      ),
      // An earlier quote. Must not reach the ledger either.
      createDocument(
        {
          charge_id: CURRENCY_DIFF_MIXED_IDS.chargeId,
          creditor_id: MIXED_VENDOR_ID,
          debtor_id: MIXED_ADMIN_ID,
          type: 'PROFORMA',
          total_amount: 1600.0,
          currency_code: Currency.Usd,
          date: '2025-03-03',
          owner_id: MIXED_ADMIN_ID,
        },
        {
          id: CURRENCY_DIFF_MIXED_IDS.documentIds.proforma,
          serial_number: 'PRO-USD-2025-0001',
          vat_amount: 0,
        },
      ),
    ],
  },
};
