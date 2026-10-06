import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { TEST_TIMEZONES, useTimezone } from '../../../../../__tests__/helpers/timezones.js';
import { Currency } from '../../../../../shared/enums.js';
import type { StrictLedgerProto, TimelessDateString } from '../../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../../admin-context/providers/admin-context.provider.js';
import {
  calculateTotalAmount,
  getChargeBusinesses,
  getChargeDocumentsMeta,
} from '../../../../charges/helpers/common.helper.js';
import type { IGetChargesByIdsResult } from '../../../../charges/types.js';
import { DocumentsProvider } from '../../../../documents/providers/documents.provider.js';
import { ExchangeProvider } from '../../../../exchange-rates/providers/exchange.provider.js';
import { BusinessesProvider } from '../../../../financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../../../../financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../../../../financial-entities/providers/tax-categories.provider.js';
import { MiscExpensesProvider } from '../../../../misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '../../../../transactions/providers/transactions.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../../transactions/types.js';
import { ledgerEntryFromDocument } from '../../../helpers/common-charge-ledger.helper.js';
import { BalanceCancellationProvider } from '../../../providers/balance-cancellation.provider.js';
import { UnbalancedBusinessesProvider } from '../../../providers/unbalanced-businesses.provider.js';
import { generateLedgerRecordsForCommonCharge } from '../common-ledger-generation.resolver.js';
import {
  at,
  buildTransaction,
  exchangeRecords,
  expectGeneratedRecords,
  makeExchangeProvider,
  makeFinancialEntitiesProvider,
  makeInjector as makeMockInjector,
  summarize,
  type MockRate,
} from './helpers/ledger-generation-mocks.js';

/*
 * A common charge: a supplier's invoice and its payment. When the invoice and the payment are
 * valued at different exchange rates, the supplier is left off by the difference, which is booked
 * as an exchange-rate record against the charge's tax category.
 *
 * Documents are valued by their day, while crypto payments are priced at their exact
 * `debit_timestamp`, so an invoice and a payment on the same day can carry different rates.
 *
 * All IDs, amounts, rates and dates below are made up. Document entries are stubbed: how they are
 * built (VAT, allocation) is not what these tests are about.
 */

vi.mock('../../../../charges/helpers/common.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../../charges/helpers/common.helper.js')>()),
  calculateTotalAmount: vi.fn(),
  getChargeBusinesses: vi.fn(),
  getChargeDocumentsMeta: vi.fn(),
}));

vi.mock('../../../helpers/common-charge-ledger.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../helpers/common-charge-ledger.helper.js')>()),
  ledgerEntryFromDocument: vi.fn(),
}));

vi.mock('../../../helpers/cross-year-ledger.helper.js', () => ({
  handleCrossYearLedgerEntries: vi.fn(async () => null),
}));

vi.mock('../../../../deel/helpers/deel.helper.js', () => ({
  getDeelEmployeeId: vi.fn(async () => undefined),
  isDeelDocument: vi.fn(() => false),
}));

const CHARGE_ID = 'charge-supplier-payment';
const OWNER_ID = 'owner-business';
const SUPPLIER_ID = 'business-supplier';
const PAYING_ACCOUNT_ID = 'account-paying';
const EXPENSES_TAX_CATEGORY_ID = 'tax-category-contractors';

const DAY: TimelessDateString = '2025-03-12';

function accountTaxCategoryId(accountId: string, currency: Currency): string {
  return `tax-category:${accountId}:${currency}`;
}

const charge: IGetChargesByIdsResult = {
  id: CHARGE_ID,
  accountant_status: 'PENDING',
  created_at: new Date('2025-03-14T00:00:00.000Z'),
  documents_optional_flag: false,
  invoice_payment_currency_diff: null,
  is_property: false,
  optional_vat: false,
  owner_id: OWNER_ID,
  tax_category_id: EXPENSES_TAX_CATEGORY_ID,
  type: 'COMMON',
  updated_at: new Date('2025-03-14T00:00:00.000Z'),
  user_description: null,
};

/** The supplier's invoice, as `ledgerEntryFromDocument` books it: valued at the invoice day */
function invoiceEntry(options: {
  currency: Currency;
  amount: number;
  rate: number;
}): StrictLedgerProto {
  return {
    id: 'invoice',
    chargeId: CHARGE_ID,
    ownerId: OWNER_ID,
    invoiceDate: DAY,
    valueDate: DAY,
    currency: options.currency,
    creditAccountID1: SUPPLIER_ID,
    creditAmount1: options.amount,
    localCurrencyCreditAmount1: options.amount * options.rate,
    debitAccountID1: EXPENSES_TAX_CATEGORY_ID,
    debitAmount1: options.amount,
    localCurrencyDebitAmount1: options.amount * options.rate,
    description: 'invoice',
    isCreditorCounterparty: true,
  };
}

function payment(options: {
  currency: Currency;
  amount: string;
  debitTimestamp?: Date;
}): IGetTransactionsByChargeIdsResult {
  return buildTransaction({
    id: 'payment',
    chargeId: CHARGE_ID,
    ownerId: OWNER_ID,
    accountId: PAYING_ACCOUNT_ID,
    businessId: SUPPLIER_ID,
    amount: options.amount,
    currency: options.currency,
    debitDate: DAY,
    debitTimestamp: options.debitTimestamp,
  });
}

function makeInjector(options: {
  transactions: IGetTransactionsByChargeIdsResult[];
  rates: MockRate[];
}): Injector {
  return makeMockInjector(
    new Map<unknown, unknown>([
      [
        AdminContextProvider,
        {
          getVerifiedAdminContext: async () => ({
            defaultLocalCurrency: Currency.Ils,
            defaultTaxCategoryId: 'tax-category-default',
            general: {
              taxCategories: {
                exchangeRateTaxCategoryId: 'tax-category-exchange-rates',
                incomeExchangeRateTaxCategoryId: 'tax-category-income-exchange-rates',
                feeTaxCategoryId: 'tax-category-fees',
                generalFeeTaxCategoryId: 'tax-category-general-fees',
              },
            },
            financialAccounts: { internalWalletsIds: [], swiftBusinessId: null },
          }),
        },
      ],
      [
        DocumentsProvider,
        {
          getDocumentsByChargeIdLoader: {
            load: async () => [{ id: 'invoice', charge_id: CHARGE_ID, type: 'INVOICE' }],
          },
        },
      ],
      [
        TransactionsProvider,
        { transactionsByChargeIDLoader: { load: async () => options.transactions } },
      ],
      [
        UnbalancedBusinessesProvider,
        { getChargeUnbalancedBusinessesByChargeIds: { load: async () => [] } },
      ],
      [
        BalanceCancellationProvider,
        { getBalanceCancellationByChargesIdLoader: { load: async () => [] } },
      ],
      [
        BusinessesProvider,
        {
          getBusinessByIdLoader: {
            load: async (id: string) => ({
              id,
              name: 'Supplier',
              can_settle_with_receipt: false,
              no_invoices_required: false,
            }),
          },
        },
      ],
      [ExchangeProvider, makeExchangeProvider(options.rates)],
      [
        TaxCategoriesProvider,
        {
          taxCategoryByFinancialAccountIdsAndCurrenciesLoader: {
            load: async ({
              financialAccountId,
              currency,
            }: {
              financialAccountId: string;
              currency: Currency;
            }) => ({ id: accountTaxCategoryId(financialAccountId, currency) }),
          },
        },
      ],
      [MiscExpensesProvider, { getExpensesByChargeIdLoader: { load: async () => [] } }],
      [FinancialEntitiesProvider, makeFinancialEntitiesProvider([SUPPLIER_ID])],
    ]),
  );
}

async function generate(injector: Injector) {
  return expectGeneratedRecords(
    await generateLedgerRecordsForCommonCharge(
      charge as never,
      { insertLedgerRecordsIfNotExists: false },
      { injector } as never,
      {} as never,
    ),
  );
}

describe.each(TEST_TIMEZONES)('generateLedgerRecordsForCommonCharge (TZ=%s)', timeZone => {
  useTimezone(timeZone);

  beforeEach(() => {
    vi.mocked(getChargeDocumentsMeta).mockResolvedValue({
      invoiceCount: 1,
      receiptCount: 0,
    } as never);
    vi.mocked(calculateTotalAmount).mockResolvedValue({
      raw: -3600,
      formatted: '-₪3,600.00',
      currency: Currency.Ils,
    } as never);
    vi.mocked(getChargeBusinesses).mockResolvedValue({
      mainBusinessId: SUPPLIER_ID,
    } as never);
  });

  it('books the rate difference between a crypto invoice and its same-day payment', async () => {
    // 1,000 USDC invoiced at the day's ₪3.60, paid from a wallet at 14:30 when it is worth ₪3.605
    const paymentTime = at(DAY, 14, 30);
    vi.mocked(ledgerEntryFromDocument).mockResolvedValue(
      invoiceEntry({ currency: Currency.Usdc, amount: 1000, rate: 3.6 }),
    );
    const injector = makeInjector({
      transactions: [
        payment({ currency: Currency.Usdc, amount: '-1000', debitTimestamp: paymentTime }),
      ],
      rates: [[Currency.Usdc, paymentTime, 3.605]],
    });

    const { records, balance, errors } = await generate(injector);

    expect(errors).toEqual([]);
    expect(balance?.isBalanced).toBe(true);
    expect(records.map(summarize)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          debit: SUPPLIER_ID,
          credit: accountTaxCategoryId(PAYING_ACCOUNT_ID, Currency.Usdc),
          currency: Currency.Usdc,
          foreignAmount: 1000,
          localAmount: 3605,
          valueDate: DAY,
        }),
      ]),
    );
    // the payment cost ₪5 more than the invoice: the supplier is credited back, against expenses
    expect(exchangeRecords(records).map(summarize)).toEqual([
      expect.objectContaining({
        debit: EXPENSES_TAX_CATEGORY_ID,
        credit: SUPPLIER_ID,
        currency: Currency.Ils,
        localAmount: 5,
        invoiceDate: DAY,
        valueDate: DAY,
      }),
    ]);
  });

  it('reports a same-day fiat mismatch instead of booking it as an exchange-rate difference', async () => {
    // a $100 invoice paid with $101 the same day: one rate, so the difference is a real mismatch
    vi.mocked(ledgerEntryFromDocument).mockResolvedValue(
      invoiceEntry({ currency: Currency.Usd, amount: 100, rate: 3.6 }),
    );
    const injector = makeInjector({
      transactions: [payment({ currency: Currency.Usd, amount: '-101' })],
      rates: [[Currency.Usd, DAY, 3.6]],
    });

    const { records, balance, errors } = await generate(injector);

    expect(exchangeRecords(records)).toEqual([]);
    expect(balance?.isBalanced).toBe(false);
    expect(errors).toContain('Failed to balance: Dates are consistent and currencies are foreign');
  });
});
