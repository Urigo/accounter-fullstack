import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { TEST_TIMEZONES, useTimezone } from '../../../../../__tests__/helpers/timezones.js';
import { Currency } from '../../../../../shared/enums.js';
import type {
  LedgerProto,
  StrictLedgerProto,
  TimelessDateString,
} from '../../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../../admin-context/providers/admin-context.provider.js';
import {
  calculateTotalAmount,
  getChargeBusinesses,
  getChargeDocumentsMeta,
} from '../../../../charges/helpers/common.helper.js';
import type { IGetChargesByIdsResult } from '../../../../charges/types.js';
import { DepreciationDisposalsProvider } from '../../../../depreciation/providers/depreciation-disposals.provider.js';
import { DepreciationProvider } from '../../../../depreciation/providers/depreciation.provider.js';
import { DocumentsProvider } from '../../../../documents/providers/documents.provider.js';
import { ExchangeProvider } from '../../../../exchange-rates/providers/exchange.provider.js';
import { BusinessesProvider } from '../../../../financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../../../../financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../../../../financial-entities/providers/tax-categories.provider.js';
import { MiscExpensesProvider } from '../../../../misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '../../../../transactions/providers/transactions.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../../transactions/types.js';
import { ledgerEntryFromDocument } from '../../../helpers/common-charge-ledger.helper.js';
import { generateDepreciationDisposalsLedger } from '../../../helpers/depreciation-disposal-ledger.helper.js';
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

vi.mock('../../../helpers/depreciation-disposal-ledger.helper.js', async importOriginal => ({
  ...(await importOriginal<
    typeof import('../../../helpers/depreciation-disposal-ledger.helper.js')
  >()),
  generateDepreciationDisposalsLedger: vi.fn(async () => ({
    entries: [],
    errors: [],
    expectedProceeds: null,
    proceedsDisposals: [],
    counterpartyRefunds: [],
  })),
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
const ASSET_ACCOUNT_ID = 'tax-category-software';
const ACCUMULATED_DEPRECIATION_ID = 'tax-category-accumulated-depreciation';
const CORRECTION_TAX_CATEGORY_ID = 'tax-category-depreciation-correction';

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

/**
 * A supplier's credit note in ILS, as `ledgerEntryFromDocument` books it: Dr supplier / Cr the
 * charge's tax category
 */
function creditNoteEntry(amount: number): StrictLedgerProto {
  return {
    id: 'credit-note',
    chargeId: CHARGE_ID,
    ownerId: OWNER_ID,
    invoiceDate: DAY,
    valueDate: DAY,
    currency: Currency.Ils,
    creditAccountID1: EXPENSES_TAX_CATEGORY_ID,
    localCurrencyCreditAmount1: amount,
    debitAccountID1: SUPPLIER_ID,
    localCurrencyDebitAmount1: amount,
    description: 'credit note',
    isCreditorCounterparty: false,
  };
}

/** The rows of a cost refund, as `generateDepreciationDisposalsLedger` books them on the charge */
function costRefundEntries(costReduction: number, correction: number): LedgerProto[] {
  const row = (id: string, debit: string, credit: string, amount: number): LedgerProto => ({
    id,
    chargeId: CHARGE_ID,
    ownerId: OWNER_ID,
    invoiceDate: DAY,
    valueDate: DAY,
    currency: Currency.Ils,
    currencyRate: 1,
    isCreditorCounterparty: true,
    debitAccountID1: debit,
    creditAccountID1: credit,
    localCurrencyDebitAmount1: amount,
    localCurrencyCreditAmount1: amount,
  });
  return [
    row('cost-reduction', EXPENSES_TAX_CATEGORY_ID, ASSET_ACCOUNT_ID, costReduction),
    row('correction', ACCUMULATED_DEPRECIATION_ID, CORRECTION_TAX_CATEGORY_ID, correction),
  ];
}

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
  disposals?: unknown[];
  depreciationRecords?: unknown[];
  miscExpenses?: unknown[];
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
      [
        MiscExpensesProvider,
        { getExpensesByChargeIdLoader: { load: async () => options.miscExpenses ?? [] } },
      ],
      [
        DepreciationDisposalsProvider,
        { getDisposalsByChargeIdLoader: { load: async () => options.disposals ?? [] } },
      ],
      [
        DepreciationProvider,
        {
          getDepreciationRecordsByChargeIdLoader: {
            load: async () => options.depreciationRecords ?? [],
          },
        },
      ],
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

  function assetPurchase(depreciationRecords: unknown[]) {
    vi.mocked(ledgerEntryFromDocument).mockResolvedValue(
      invoiceEntry({ currency: Currency.Usd, amount: 1000, rate: 3.6 }),
    );
    const paymentDay: TimelessDateString = '2025-03-19';
    return makeInjector({
      transactions: [
        buildTransaction({
          id: 'payment',
          chargeId: CHARGE_ID,
          ownerId: OWNER_ID,
          accountId: PAYING_ACCOUNT_ID,
          businessId: SUPPLIER_ID,
          amount: '-1000',
          currency: Currency.Usd,
          debitDate: paymentDay,
        }),
      ],
      rates: [[Currency.Usd, paymentDay, 3.7]],
      depreciationRecords,
    });
  }

  it("books a foreign-currency asset purchase's rate difference to exchange rates, not to the asset account", async () => {
    // a $1,000 asset recorded in USD, invoiced at the day's ₪3.60 and paid a week later at ₪3.70:
    // the asset's cost stays at the invoice rate, so the ₪100 difference is a financial expense
    const { records, balance, errors } = await generate(
      assetPurchase([{ id: 'asset', charge_id: CHARGE_ID, currency: Currency.Usd }]),
    );

    expect(errors).toEqual([]);
    expect(balance?.isBalanced).toBe(true);
    expect(exchangeRecords(records).map(summarize)).toEqual([
      expect.objectContaining({
        debit: 'tax-category-exchange-rates',
        credit: SUPPLIER_ID,
        currency: Currency.Ils,
        localAmount: 100,
      }),
    ]);
  });

  it('keeps booking the rate difference to the tax category for an asset recorded in ILS', async () => {
    // the same purchase, its asset recorded in ILS at its stored amount: as before
    const { records, balance, errors } = await generate(
      assetPurchase([{ id: 'asset', charge_id: CHARGE_ID, currency: Currency.Ils }]),
    );

    expect(errors).toEqual([]);
    expect(balance?.isBalanced).toBe(true);
    expect(exchangeRecords(records).map(summarize)).toEqual([
      expect.objectContaining({
        debit: EXPENSES_TAX_CATEGORY_ID,
        credit: SUPPLIER_ID,
        currency: Currency.Ils,
        localAmount: 100,
      }),
    ]);
  });

  describe('an asset purchase entered as misc expenses, without documents', () => {
    // USD 1,000 of software bought from the supplier on the contract day (₪3.60), paid a week later
    // at ₪3.70
    const paymentDay: TimelessDateString = '2025-03-19';

    function acquisition(depreciationRecords: unknown[]) {
      vi.mocked(getChargeDocumentsMeta).mockResolvedValue({
        invoiceCount: 0,
        receiptCount: 0,
      } as never);
      const contractTime = at(DAY, 0, 0);
      return makeInjector({
        miscExpenses: [
          {
            id: 'software',
            charge_id: CHARGE_ID,
            owner_id: OWNER_ID,
            amount: '1000',
            currency: Currency.Usd,
            creditor_id: SUPPLIER_ID,
            debtor_id: 'tax-category-software',
            description: 'software',
            invoice_date: DAY,
            value_date: contractTime,
          },
        ],
        transactions: [
          buildTransaction({
            id: 'payment',
            chargeId: CHARGE_ID,
            ownerId: OWNER_ID,
            accountId: PAYING_ACCOUNT_ID,
            businessId: SUPPLIER_ID,
            amount: '-1000',
            currency: Currency.Usd,
            debitDate: paymentDay,
          }),
        ],
        rates: [
          [Currency.Usd, contractTime, 3.6],
          [Currency.Usd, paymentDay, 3.7],
        ],
        depreciationRecords,
      });
    }

    it("books the payment's rate difference to exchange rates when the charge carries foreign-currency assets", async () => {
      const { records, balance, errors } = await generate(
        acquisition([{ id: 'asset', charge_id: CHARGE_ID, currency: Currency.Usd }]),
      );

      expect(errors).toEqual([]);
      expect(balance?.isBalanced).toBe(true);
      expect(exchangeRecords(records).map(summarize)).toEqual([
        expect.objectContaining({
          debit: 'tax-category-exchange-rates',
          credit: SUPPLIER_ID,
          currency: Currency.Ils,
          localAmount: 100,
        }),
      ]);
    });

    it('still finds no exchange rate account for misc expenses of a charge without assets', async () => {
      const { records, errors } = await generate(acquisition([]));

      expect(exchangeRecords(records)).toEqual([]);
      expect(errors).toContain(
        `Failed to locate tax category for exchange rate for business ID="${SUPPLIER_ID}"`,
      );
    });

    it('still finds no exchange rate account for misc expenses of assets recorded in ILS', async () => {
      const { records, errors } = await generate(
        acquisition([{ id: 'asset', charge_id: CHARGE_ID, currency: Currency.Ils }]),
      );

      expect(exchangeRecords(records)).toEqual([]);
      expect(errors).toContain(
        `Failed to locate tax category for exchange rate for business ID="${SUPPLIER_ID}"`,
      );
    });
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
  it('appends the entries of asset disposals the charge carries', async () => {
    // a supplier refund booked to the asset account, with a disposal linked to the charge
    vi.mocked(ledgerEntryFromDocument).mockResolvedValue(
      invoiceEntry({ currency: Currency.Ils, amount: 3600, rate: 1 }),
    );
    const disposal = { id: 'disposal', depreciation_id: 'asset', charge_id: CHARGE_ID };
    vi.mocked(generateDepreciationDisposalsLedger).mockResolvedValueOnce({
      entries: [
        {
          id: 'disposal-ad',
          chargeId: CHARGE_ID,
          ownerId: OWNER_ID,
          invoiceDate: DAY,
          valueDate: DAY,
          currency: Currency.Ils,
          currencyRate: 1,
          isCreditorCounterparty: true,
          debitAccountID1: 'tax-category-accumulated-depreciation',
          creditAccountID1: EXPENSES_TAX_CATEGORY_ID,
          localCurrencyDebitAmount1: 500,
          localCurrencyCreditAmount1: 500,
          description: 'Asset disposal: accumulated depreciation',
        },
      ],
      errors: [],
      expectedProceeds: null,
      proceedsDisposals: [],
      counterpartyRefunds: [],
    });
    const injector = makeInjector({
      transactions: [payment({ currency: Currency.Ils, amount: '-3600' })],
      rates: [],
      disposals: [disposal],
    });

    const { records, errors } = await generate(injector);

    expect(errors).toEqual([]);
    // after the charge's own entries, which it gets without disposal rows
    expect(generateDepreciationDisposalsLedger).toHaveBeenCalledWith(
      [disposal],
      charge,
      injector,
      EXPENSES_TAX_CATEGORY_ID,
      expect.arrayContaining([expect.objectContaining({ id: 'invoice' })]),
      SUPPLIER_ID,
      [expect.objectContaining({ id: 'invoice' })],
    );
    const [, , , , chargeEntries] = vi.mocked(generateDepreciationDisposalsLedger).mock.calls[0];
    expect(chargeEntries?.some(entry => entry.description?.startsWith('Asset disposal'))).toBe(
      false,
    );
    expect(records.map(summarize)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          debit: 'tax-category-accumulated-depreciation',
          credit: EXPENSES_TAX_CATEGORY_ID,
          localAmount: 500,
          valueDate: DAY,
        }),
      ]),
    );
  });
  describe('a cost refund charge', () => {
    // the supplier refunds ₪20,000 of an asset's price: a credit note to the charge's tax category
    // P and the money received; the refund's rows move the ₪20,000 from P to the asset
    const refund = { id: 'refund', depreciation_id: 'asset', charge_id: CHARGE_ID } as never;

    function refundInjector() {
      vi.mocked(ledgerEntryFromDocument).mockResolvedValue(creditNoteEntry(20_000));
      return makeInjector({
        transactions: [payment({ currency: Currency.Ils, amount: '20000' })],
        rates: [],
        disposals: [refund],
      });
    }

    it('balances when the charge credits P with the cost reductions', async () => {
      vi.mocked(generateDepreciationDisposalsLedger).mockResolvedValueOnce({
        entries: costRefundEntries(20_000, 1500),
        errors: [],
        expectedProceeds: 20_000,
        proceedsDisposals: [refund],
        counterpartyRefunds: [],
      });

      const { records, balance, errors } = await generate(refundInjector());

      expect(errors).toEqual([]);
      expect(balance?.isBalanced).toBe(true);
      expect(records.map(summarize)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            debit: EXPENSES_TAX_CATEGORY_ID,
            credit: ASSET_ACCOUNT_ID,
            localAmount: 20_000,
          }),
          expect.objectContaining({
            debit: ACCUMULATED_DEPRECIATION_ID,
            credit: CORRECTION_TAX_CATEGORY_ID,
            localAmount: 1500,
          }),
        ]),
      );
    });

    it('reports cost reductions that differ from what the charge credits P', async () => {
      // the refunds entered on the assets come to ₪25,000, but the credit note is for ₪20,000
      vi.mocked(generateDepreciationDisposalsLedger).mockResolvedValueOnce({
        entries: costRefundEntries(25_000, 1500),
        errors: [],
        expectedProceeds: 25_000,
        proceedsDisposals: [refund],
        counterpartyRefunds: [],
      });

      const { errors } = await generate(refundInjector());

      expect(errors).toEqual([
        `Sales and cost refunds of depreciated assets come to 25,000.00, but the charge credits 20,000.00 to its tax category "${EXPENSES_TAX_CATEGORY_ID}" (-5,000.00 diff): book the refund with a credit-note document to the charge's tax category, or leave it to the refund record, which books it against the charge's counterparty (misc expenses don't stand in for a credit note)`,
      ]);
    });
  });

  describe('a cost refund booked by its record, against the supplier', () => {
    /*
     * The supplier refunds USD 36,000 of two USD assets with no credit note: the charge carries the
     * USD receipt, the bank fee and an unrelated misc expense crediting the asset account (refunded
     * receivables), all at the day's ₪3.65. The refund records book the cost reductions against
     * the supplier, at the assets' ₪3.70.
     */
    const FEES_TAX_CATEGORY_ID = 'tax-category-bank-fees';
    const refundEvents = [
      { id: 'software-refund', original_amount: '16000', original_currency: 'USD' },
      { id: 'customers-refund', original_amount: '20000', original_currency: 'USD' },
    ] as never[];

    /** A USD row of a refund record, as `generateDepreciationDisposalsLedger` books it */
    function usdRow(debit: string, credit: string, usd: number, what: string): LedgerProto {
      return {
        id: `${what}-${usd}`,
        chargeId: CHARGE_ID,
        ownerId: OWNER_ID,
        invoiceDate: DAY,
        valueDate: DAY,
        currency: Currency.Usd,
        currencyRate: 3.7,
        isCreditorCounterparty: true,
        debitAccountID1: debit,
        creditAccountID1: credit,
        debitAmount1: usd,
        creditAmount1: usd,
        localCurrencyDebitAmount1: usd * 3.7,
        localCurrencyCreditAmount1: usd * 3.7,
        description: `Asset cost refund: ${what}`,
      };
    }

    function miscExpense(id: string, debtor: string, creditor: string, usd: number) {
      return {
        id,
        charge_id: CHARGE_ID,
        owner_id: OWNER_ID,
        amount: String(usd),
        currency: Currency.Usd,
        creditor_id: creditor,
        debtor_id: debtor,
        description: id,
        invoice_date: DAY,
        value_date: at(DAY, 0, 0),
      };
    }

    function counterpartyRefund(receivedUsd: number) {
      vi.mocked(getChargeDocumentsMeta).mockResolvedValue({
        invoiceCount: 0,
        receiptCount: 0,
      } as never);
      vi.mocked(generateDepreciationDisposalsLedger).mockResolvedValueOnce({
        entries: [
          usdRow(SUPPLIER_ID, ASSET_ACCOUNT_ID, 16_000, 'cost reduction'),
          usdRow(ACCUMULATED_DEPRECIATION_ID, CORRECTION_TAX_CATEGORY_ID, 500, 'correction'),
          usdRow(SUPPLIER_ID, ASSET_ACCOUNT_ID, 20_000, 'cost reduction'),
        ],
        errors: [],
        expectedProceeds: null,
        proceedsDisposals: [],
        counterpartyRefunds: refundEvents,
      });
      return makeInjector({
        transactions: [payment({ currency: Currency.Usd, amount: String(receivedUsd) })],
        rates: [
          [Currency.Usd, DAY, 3.65],
          [Currency.Usd, at(DAY, 0, 0), 3.65],
        ],
        disposals: refundEvents,
        miscExpenses: [
          miscExpense('fee', FEES_TAX_CATEGORY_ID, SUPPLIER_ID, 20),
          miscExpense('receivables', SUPPLIER_ID, ASSET_ACCOUNT_ID, 5000),
        ],
      });
    }

    it('balances the supplier in USD, and books its local gap to exchange rates', async () => {
      // USD 40,980 received and USD 20 of fees, for USD 36,000 refunded and USD 5,000 repaid
      const { records, balance, errors } = await generate(counterpartyRefund(40_980));

      expect(errors).toEqual([]);
      expect(balance?.isBalanced).toBe(true);
      // the supplier: credited ₪149,650 at ₪3.65, debited ₪18,250 at ₪3.65 and ₪133,200 at ₪3.70
      expect(exchangeRecords(records).map(summarize)).toEqual([
        expect.objectContaining({
          debit: 'tax-category-exchange-rates',
          credit: SUPPLIER_ID,
          currency: Currency.Ils,
          localAmount: 1800,
        }),
      ]);
    });

    it("reports the supplier's balance when the refunds don't match the money received", async () => {
      // USD 1,000 more received than refunded and repaid
      const { records, errors } = await generate(counterpartyRefund(41_980));

      expect(exchangeRecords(records)).toEqual([]);
      expect(errors).toEqual([
        'Exchange rate error - USD amount not balanced By 1000.00$',
        expect.stringMatching(/^Business "business-supplier" is unbalanced/),
      ]);
    });
  });
});
