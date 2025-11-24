import { CountryCode } from '@modules/countries/types.js';
import { Currency } from '@shared/enums';
import { makeUUID } from '../../helpers/deterministic-uuid.js';
import type { UseCaseSpec } from '../../types.js';

/**
 * Monthly Expense Use-Case: Foreign Currency Transaction
 *
 * Demonstrates a US-based supplier invoice paid via bank transfer with
 * exchange rate conversion from USD to ILS. This use-case validates:
 * - Foreign currency transaction handling
 * - Exchange rate application
 * - Cross-border payment processing
 * - Ledger generation with currency conversion
 */
export const monthlyExpenseForeignCurrency: UseCaseSpec = {
  id: 'monthly-expense-foreign-currency',
  name: 'Monthly Expense (Foreign Currency)',
  description:
    'US-based supplier invoice paid via bank transfer with exchange rate conversion from USD to ILS. Validates foreign currency handling and ledger generation.',
  category: 'expenses',
  fixtures: {
    businesses: [
      {
        id: makeUUID('business', 'us-supplier-acme-llc'),
        name: 'Acme Consulting LLC',
        country: CountryCode['United States of America (the)'],
        canSettleWithReceipt: false,
      },
    ],
    taxCategories: [
      {
        id: makeUUID('tax-category', 'consulting-expenses'),
        name: 'Consulting Expenses',
      },
    ],
    financialAccounts: [
      {
        id: makeUUID('financial-account', 'bank-usd-account'),
        accountNumber: '123-456-7890',
        type: 'BANK_ACCOUNT',
        currency: Currency.Usd,
        taxCategoryMappings: [
          {
            taxCategoryId: makeUUID('tax-category', 'consulting-expenses'),
            currency: Currency.Usd,
          },
        ],
      },
    ],
    charges: [
      {
        id: makeUUID('charge', 'consulting-invoice-2024-11'),
        ownerId: '{{ADMIN_BUSINESS_ID}}',
        userDescription: 'November consulting services',
      },
    ],
    transactions: [
      {
        id: makeUUID('transaction', 'consulting-payment-usd'),
        chargeId: makeUUID('charge', 'consulting-invoice-2024-11'),
        businessId: makeUUID('business', 'us-supplier-acme-llc'),
        amount: '-500.00',
        currency: Currency.Usd,
        eventDate: '2024-11-15',
        debitDate: '2024-11-15',
        accountNumber: '123-456-7890',
      },
    ],
    documents: [
      {
        id: makeUUID('document', 'consulting-invoice-inv-2024-1115'),
        chargeId: makeUUID('charge', 'consulting-invoice-2024-11'),
        creditorId: makeUUID('business', 'us-supplier-acme-llc'),
        debtorId: '{{ADMIN_BUSINESS_ID}}',
        serialNumber: 'INV-2024-1115',
        type: 'INVOICE',
        date: '2024-11-01',
        totalAmount: '500.00',
        currencyCode: Currency.Usd,
      },
    ],
  },
  metadata: {
    author: 'demo-team',
    createdAt: '2024-11-24',
    updatedAt: '2024-11-24',
  },
  expectations: {
    ledgerRecordCount: 2,
  },
};
