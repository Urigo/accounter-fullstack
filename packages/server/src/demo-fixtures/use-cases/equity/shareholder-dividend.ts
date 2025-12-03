import { CountryCode } from '../../../modules/countries/types.js';
import { Currency } from '../../../shared/enums.js';
import { makeUUID } from '../../helpers/deterministic-uuid.js';
import type { UseCaseSpec } from '../../types.js';

/**
 * Shareholder Dividend (Q4 2024)
 *
 * Models a dividend payout in ILS with a single transaction
 * and optional statement document. Designed as a simple
 * equity scenario with minimal entities.
 */
export const shareholderDividend: UseCaseSpec = {
  id: 'shareholder-dividend',
  name: 'Shareholder Dividend (Q4 2024)',
  description:
    'Dividend payout from ILS bank account with withholding tax counterparty. Includes optional statement document.',
  category: 'equity',
  fixtures: {
    businesses: [
      {
        id: makeUUID('business', 'dividends-withholding-tax'),
        name: 'Dividends Withholding Tax',
        country: CountryCode['Israel'],
        canSettleWithReceipt: false,
      },
    ],
    taxCategories: [
      {
        id: makeUUID('tax-category', 'dividend'),
        name: 'Dividend',
      },
    ],
    financialAccounts: [
      {
        id: makeUUID('financial-account', 'bank-ils-account'),
        accountNumber: '11-222-3333',
        type: 'BANK_ACCOUNT',
        currency: Currency.Ils,
        taxCategoryMappings: [
          {
            taxCategoryId: makeUUID('tax-category', 'dividend'),
            currency: Currency.Ils,
          },
        ],
      },
    ],
    charges: [
      {
        id: makeUUID('charge', 'dividend-distribution-2024-q4'),
        ownerId: '{{ADMIN_BUSINESS_ID}}',
        userDescription: 'Dividend distribution for Q4 2024',
      },
    ],
    transactions: [
      {
        id: makeUUID('transaction', 'dividend-payout-2024-q4'),
        chargeId: makeUUID('charge', 'dividend-distribution-2024-q4'),
        businessId: makeUUID('business', 'dividends-withholding-tax'),
        amount: '-10000.00',
        currency: Currency.Ils,
        eventDate: '2024-12-31',
        debitDate: '2024-12-31',
        accountNumber: '11-222-3333',
      },
    ],
    documents: [
      {
        id: makeUUID('document', 'dividend-statement-2024-q4'),
        chargeId: makeUUID('charge', 'dividend-distribution-2024-q4'),
        creditorId: makeUUID('business', 'dividends-withholding-tax'),
        debtorId: '{{ADMIN_BUSINESS_ID}}',
        serialNumber: 'DIV-2024-Q4',
        type: 'INVOICE',
        date: '2024-12-31',
        totalAmount: '10000.00',
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
    ledgerRecordCount: 2,
  },
};
