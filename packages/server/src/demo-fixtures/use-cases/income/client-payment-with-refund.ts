import type { UseCaseSpec } from '../../../fixtures/fixture-spec.js';
import { CountryCode, Currency } from '../../../shared/enums.js';
import { makeUUID } from '../../helpers/deterministic-uuid.js';

/**
 * Client Payment with Refund Cycle
 *
 * Models an income scenario where a client pays an invoice
 * and later receives a partial refund via a credit invoice.
 * Sign convention follows demo rules: negative amount = income,
 * positive amount = reversal/refund.
 */
export const clientPaymentWithRefund: UseCaseSpec = {
  id: 'client-payment-with-refund',
  name: 'Client Payment with Refund',
  description:
    'Client invoice paid (income) followed by a partial refund via credit invoice. Uses ILS bank account.',
  category: 'income',
  fixtures: {
    businesses: [
      {
        id: makeUUID('business', 'acme-retail-client'),
        name: 'Acme Retail Client',
        country: CountryCode['Israel'],
        canSettleWithReceipt: false,
      },
    ],
    taxCategories: [
      {
        id: makeUUID('tax-category', 'service-income'),
        name: 'Service Income',
      },
    ],
    financialAccounts: [
      {
        id: makeUUID('financial-account', 'bank-ils-account-income'),
        accountNumber: '22-333-4444',
        type: 'BANK_ACCOUNT',
        currency: Currency.Ils,
        taxCategoryMappings: [
          {
            taxCategoryId: makeUUID('tax-category', 'service-income'),
            currency: Currency.Ils,
          },
        ],
      },
    ],
    charges: [
      {
        id: makeUUID('charge', 'client-invoice-2024-11'),
        ownerId: '{{ADMIN_BUSINESS_ID}}',
        userDescription: 'Client invoice for November services',
      },
      {
        id: makeUUID('charge', 'client-refund-credit-2024-11'),
        ownerId: '{{ADMIN_BUSINESS_ID}}',
        userDescription: 'Refund credit for November services',
      },
    ],
    transactions: [
      {
        id: makeUUID('transaction', 'client-payment-2024-11-15'),
        chargeId: makeUUID('charge', 'client-invoice-2024-11'),
        businessId: makeUUID('business', 'acme-retail-client'),
        amount: '-2000.00',
        currency: Currency.Ils,
        eventDate: '2024-11-15',
        debitDate: '2024-11-15',
        accountNumber: '22-333-4444',
      },
      {
        id: makeUUID('transaction', 'client-refund-2024-11-20'),
        chargeId: makeUUID('charge', 'client-refund-credit-2024-11'),
        businessId: makeUUID('business', 'acme-retail-client'),
        amount: '500.00',
        currency: Currency.Ils,
        eventDate: '2024-11-20',
        debitDate: '2024-11-20',
        accountNumber: '22-333-4444',
      },
    ],
    documents: [
      {
        id: makeUUID('document', 'client-invoice-inv-2024-11-01'),
        chargeId: makeUUID('charge', 'client-invoice-2024-11'),
        creditorId: '{{ADMIN_BUSINESS_ID}}',
        debtorId: makeUUID('business', 'acme-retail-client'),
        serialNumber: 'INV-2024-11-01',
        type: 'INVOICE',
        date: '2024-11-01',
        totalAmount: '2000.00',
        currencyCode: Currency.Ils,
      },
      {
        id: makeUUID('document', 'client-credit-invoice-2024-11-20'),
        chargeId: makeUUID('charge', 'client-refund-credit-2024-11'),
        creditorId: '{{ADMIN_BUSINESS_ID}}',
        debtorId: makeUUID('business', 'acme-retail-client'),
        serialNumber: 'CR-2024-11-20',
        type: 'CREDIT_INVOICE',
        date: '2024-11-20',
        totalAmount: '500.00',
        currencyCode: Currency.Ils,
      },
    ],
  },
  metadata: {
    author: 'demo-team',
    createdAt: '2024-11-24',
    updatedAt: '2024-11-24',
  },
  expectations: {
    ledgerRecordCount: 4,
  },
};
