import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { Currency, SecurityPaymentType, SecurityTradeType } from '../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import type { AdminContext } from '../../../admin-context/types.js';
import { ExchangeRateNotAvailableError } from '../../../exchange-rates/helpers/exchange.helper.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import { TaxCategoriesProvider } from '../../../financial-entities/providers/tax-categories.provider.js';
import {
  paymentTypeToRaw,
  tradeTypeToRaw,
} from '../../../foreign-securities/helpers/security-execution-enums.helper.js';
import { ForeignSecuritiesProvider } from '../../../foreign-securities/providers/foreign-securities.provider.js';
import type { SecurityExecutionRow } from '../../../foreign-securities/types.js';
import { LedgerProvider } from '../../../ledger/providers/ledger.provider.js';
import { PriceIndexesProvider } from '../../../price-indexes/providers/price-indexes.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import {
  collectHalfDisposals,
  collectHalfSecuritiesExpenses,
  collectHalfSecuritiesIncome,
} from '../securities-semi-annual-report-data.helper.js';
import { getSemiAnnualPeriod } from '../securities-semi-annual-report.helper.js';

/*
 * What the semi-annual securities report reads off the executions and the ledger, with every
 * provider mocked. All values are made up.
 */

const OWNER_ID = 'owner-business';
const USD_LABEL = 'דולר ארה"ב';
const H1 = getSemiAnnualPeriod(2025, 'H1');

const BUY_DAY: TimelessDateString = '2024-11-10';
const SALE_DAY: TimelessDateString = '2025-03-12';
const RATES: Record<string, number> = { [BUY_DAY]: 3.5, [SALE_DAY]: 3.6, '2025-04-01': 3.7 };

function execution(
  overrides: Partial<SecurityExecutionRow> & Pick<SecurityExecutionRow, 'id' | 'trade_type'>,
): SecurityExecutionRow & { security_business_id: string | null } {
  return {
    owner_id: OWNER_ID,
    security: '7654321',
    symbol: 'MOCK',
    isin: 'US0000000001',
    bank_number: 12,
    branch_number: 600,
    account_number: 111111,
    trade_currency: USD_LABEL,
    settlement_currency: USD_LABEL,
    net_value_nis: '0',
    payment_type: null,
    is_cancel_transaction: 'לא',
    foreign_tax_value_settlement_currency: null,
    israel_tax_value_by_payments_settlement_currency: null,
    capital_tax_value_settlement_currency: null,
    trade_gross_value_nis: null,
    security_business_id: 'security-business',
    ...overrides,
  } as SecurityExecutionRow & { security_business_id: string | null };
}

const buy = execution({
  id: 'buy',
  trade_type: tradeTypeToRaw[SecurityTradeType.Buy],
  trade_date: BUY_DAY,
  nv: '10',
  trade_gross_value_trade_currency: '1000',
  net_value_trade_currency: '-1000',
  net_value_settlement_currency: '-1000',
});

const sale = (id: string, tradeDate: TimelessDateString, overrides = {}) =>
  execution({
    id,
    trade_type: tradeTypeToRaw[SecurityTradeType.Sell],
    trade_date: tradeDate,
    nv: '10',
    trade_gross_value_trade_currency: '1100',
    net_value_trade_currency: '1100',
    net_value_settlement_currency: '1100',
    ...overrides,
  });

function makeInjector(params: {
  executions?: SecurityExecutionRow[];
  history?: SecurityExecutionRow[] | Error;
  ledgerRecords?: unknown[];
  transactionsByCharge?: Record<string, { id: string; origin_key: string }[]>;
  executionsByTransaction?: Record<string, Record<string, SecurityExecutionRow>>;
  distributionsByCharge?: Record<string, SecurityExecutionRow[]>;
  taxCategoryNames?: Record<string, string>;
}) {
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      { getVerifiedAdminContext: async () => ({ defaultLocalCurrency: Currency.Ils }) },
    ],
    [
      ForeignSecuritiesProvider,
      {
        getOwnerExecutionsByTradeDates: vi.fn(
          async ({
            fromDate,
            toDate,
            tradeTypes,
          }: {
            fromDate: TimelessDateString;
            toDate: TimelessDateString;
            tradeTypes: SecurityTradeType[];
          }) =>
            (params.executions ?? []).filter(
              row =>
                row.trade_date >= fromDate &&
                row.trade_date <= toDate &&
                tradeTypes.map(type => tradeTypeToRaw[type]).includes(row.trade_type),
            ),
        ),
        getSecurityOwnerHistory: async () => {
          if (params.history instanceof Error) {
            throw params.history;
          }
          return params.history ?? [];
        },
        getChargeExecutionsByTransactionId: async (chargeId: string) =>
          new Map(Object.entries(params.executionsByTransaction?.[chargeId] ?? {})),
        executionsByChargeIdLoader: {
          load: async (chargeId: string) => params.distributionsByCharge?.[chargeId] ?? [],
        },
      },
    ],
    [
      ExchangeProvider,
      {
        getExchangeRates: async (_from: Currency, _to: Currency, date: TimelessDateString) => {
          const rate = RATES[date];
          if (rate == null) {
            throw new ExchangeRateNotAvailableError(`No mock rate for ${date}`);
          }
          return rate;
        },
      },
    ],
    [
      PriceIndexesProvider,
      {
        // a flat 1% rise between any two days
        linkAmount: async (amount: number) => ({
          linkedAmount: amount * 1.01,
          linkageDifference: amount * 0.01,
          ratio: 1.01,
          changePercent: 1,
          fromIndex: { period: '2024-10-01' },
          toIndex: { period: '2025-02-01' },
        }),
      },
    ],
    [
      LedgerProvider,
      { getLedgerRecordsByFilters: vi.fn(async () => params.ledgerRecords ?? []) },
    ],
    [
      TaxCategoriesProvider,
      {
        taxCategoryByIdLoader: {
          loadMany: async (ids: string[]) =>
            ids.map(id => {
              const name = params.taxCategoryNames?.[id];
              return name ? { id, name } : undefined;
            }),
        },
      },
    ],
    [
      TransactionsProvider,
      {
        transactionsByChargeIDLoader: {
          load: async (chargeId: string) => params.transactionsByCharge?.[chargeId] ?? [],
        },
      },
    ],
  ]);
  return { get: (token: unknown) => providers.get(token) } as unknown as Injector;
}

describe('collectHalfDisposals', () => {
  it("prices a sale from its FIFO lots at the trade dates' rates", async () => {
    const theSale = sale('sale', SALE_DAY, { israel_tax_value_by_payments_settlement_currency: '10' });

    const { sales, issues } = await collectHalfDisposals(
      makeInjector({ executions: [buy, theSale], history: [buy, theSale] }),
      { ownerId: OWNER_ID, period: H1, localCurrency: Currency.Ils },
    );

    expect(issues).toEqual([]);
    expect(sales).toHaveLength(1);
    const [figures] = sales;
    expect(figures.tradeType).toBe(SecurityTradeType.Sell);
    expect(figures.quantity).toBe(10);
    // 1,100 × 3.60, against 1,000 × 3.50
    expect(figures.consideration).toBeCloseTo(3960, 6);
    expect(figures.cost).toBeCloseTo(3500, 6);
    expect(figures.nominalGain).toBeCloseTo(460, 6);
    // 1% of the 3,500 original price is the inflationary amount
    expect(figures.inflationaryAmount).toBeCloseTo(35, 6);
    expect(figures.realGain).toBeCloseTo(425, 6);
    expect(figures.israeliTaxWithheld).toBeCloseTo(36, 6);
    expect(figures.error).toBeNull();
  });

  it('drops a cancelled sale with its cancellation, even one cancelled just after the half', async () => {
    const cancelled = sale('cancelled', '2025-06-29');
    const cancellation = sale('cancellation', '2025-07-02', {
      is_cancel_transaction: 'כן',
      net_value_trade_currency: '-1100',
    });

    const { sales, issues } = await collectHalfDisposals(
      makeInjector({ executions: [buy, cancelled, cancellation], history: [buy] }),
      { ownerId: OWNER_ID, period: H1, localCurrency: Currency.Ils },
    );

    expect(sales).toEqual([]);
    expect(issues).toEqual([]);
  });

  it('reports a cancellation whose sale is not in the half', async () => {
    const cancellation = sale('cancellation', '2025-01-05', {
      is_cancel_transaction: 'כן',
      net_value_trade_currency: '-1100',
    });

    const { sales, issues } = await collectHalfDisposals(
      makeInjector({ executions: [cancellation] }),
      { ownerId: OWNER_ID, period: H1, localCurrency: Currency.Ils },
    );

    expect(sales).toEqual([]);
    expect(issues).toEqual([
      expect.objectContaining({
        executionId: 'cancellation',
        message: expect.stringContaining('matches no sale in the half'),
      }),
    ]);
  });

  it('drops a cancelled buy the bank reports as a sale, with no issue', async () => {
    const bought = execution({ ...buy, id: 'bought', trade_date: '2025-01-29' });
    const cancellation = sale('cancellation', '2025-01-29', {
      is_cancel_transaction: 'כן',
      trade_gross_value_trade_currency: '1000',
      net_value_trade_currency: '1000',
    });

    // in the half with its buy, and on its own when the buy was in an earlier half
    for (const executions of [[bought, cancellation], [cancellation]]) {
      const { sales, issues } = await collectHalfDisposals(makeInjector({ executions }), {
        ownerId: OWNER_ID,
        period: H1,
        localCurrency: Currency.Ils,
      });

      expect(sales).toEqual([]);
      expect(issues).toEqual([]);
    }
  });

  it('drops a cancelled sale the bank reports as a buy', async () => {
    const cancelled = sale('cancelled', SALE_DAY);
    const cancellation = execution({
      ...buy,
      id: 'cancellation',
      trade_date: SALE_DAY,
      is_cancel_transaction: 'כן',
      trade_gross_value_trade_currency: '1100',
      net_value_trade_currency: '-1100',
    });

    const { sales, issues } = await collectHalfDisposals(
      makeInjector({ executions: [cancelled, cancellation] }),
      { ownerId: OWNER_ID, period: H1, localCurrency: Currency.Ils },
    );

    expect(sales).toEqual([]);
    expect(issues).toEqual([]);
  });

  it('still counts the consideration of a sale whose cost is unknown', async () => {
    const theSale = sale('sale', SALE_DAY);

    const { sales, issues } = await collectHalfDisposals(
      makeInjector({ executions: [theSale], history: [theSale] }),
      { ownerId: OWNER_ID, period: H1, localCurrency: Currency.Ils },
    );

    expect(sales).toHaveLength(1);
    expect(sales[0].consideration).toBeCloseTo(3960, 6);
    expect(sales[0].realGain).toBeNull();
    expect(sales[0].cost).toBeNull();
    expect(sales[0].error).toEqual(expect.any(String));
    expect(issues).toEqual([
      expect.objectContaining({
        executionId: 'sale',
        message: expect.stringContaining('Its consideration is counted in the turnover'),
      }),
    ]);
  });

  it("falls back to the bank's shekel value when there is no rate", async () => {
    const theSale = sale('sale', '2025-05-05', { trade_gross_value_nis: '4000' });

    const { sales } = await collectHalfDisposals(
      makeInjector({ executions: [theSale], history: [theSale] }),
      { ownerId: OWNER_ID, period: H1, localCurrency: Currency.Ils },
    );

    expect(sales[0].consideration).toBe(4000);
  });

  it('fails on a failure to read the data, rather than leaving the sale out', async () => {
    const theSale = sale('sale', SALE_DAY);

    await expect(
      collectHalfDisposals(
        makeInjector({ executions: [theSale], history: new Error('connection terminated') }),
        { ownerId: OWNER_ID, period: H1, localCurrency: Currency.Ils },
      ),
    ).rejects.toThrow('connection terminated');
  });

  it('flags foreign tax withheld on a sale', async () => {
    const theSale = sale('sale', SALE_DAY, { foreign_tax_value_settlement_currency: '5' });

    const { issues } = await collectHalfDisposals(
      makeInjector({ executions: [buy, theSale], history: [buy, theSale] }),
      { ownerId: OWNER_ID, period: H1, localCurrency: Currency.Ils },
    );

    expect(issues).toEqual([
      expect.objectContaining({ message: expect.stringContaining('Foreign tax of 5') }),
    ]);
  });
});

const TAX_CATEGORIES = {
  LOCAL_DIVIDEND_INCOME: 'local-dividend-income',
  FOREIGN_DIVIDEND_INCOME: 'foreign-dividend-income',
  FOREIGN_DIVIDEND_WITHHOLDING_TAX: 'foreign-dividend-withholding',
  LOCAL_DIVIDEND_WITHHOLDING_TAX: 'local-dividend-withholding',
  FOREIGN_BOND_INTEREST_INCOME: 'foreign-interest-income',
  FOREIGN_BOND_WITHHOLDING_TAX: 'foreign-bond-withholding',
};

const adminContext = (taxCategories: Record<string, string> = TAX_CATEGORIES) =>
  ({ locality: 'ISR', foreignSecurities: { taxCategories } }) as unknown as AdminContext;

const ledgerRecord = (overrides: Record<string, unknown>) => ({
  id: 'record',
  charge_id: 'charge',
  invoice_date: '2025-04-01',
  description: 'Dividend',
  reference1: 'origin-key',
  debit_entity1: 'bank',
  debit_entity2: null,
  credit_entity1: null,
  credit_entity2: null,
  debit_local_amount1: null,
  debit_local_amount2: null,
  credit_local_amount1: null,
  credit_local_amount2: null,
  debit_foreign_amount1: null,
  debit_foreign_amount2: null,
  credit_foreign_amount1: null,
  credit_foreign_amount2: null,
  ...overrides,
});

// a foreign dividend of 1,000 at 3.70: 150 withheld abroad and 100 in Israel
const dividendRecord = ledgerRecord({
  credit_entity1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME,
  credit_local_amount1: '3700',
  credit_foreign_amount1: '1000',
  debit_local_amount1: '2775',
  debit_foreign_amount1: '750',
  debit_entity2: TAX_CATEGORIES.FOREIGN_DIVIDEND_WITHHOLDING_TAX,
  debit_local_amount2: '925',
  debit_foreign_amount2: '250',
});
const dividendExecution = execution({
  id: 'dividend-execution',
  trade_type: tradeTypeToRaw[SecurityTradeType.DividendPayment],
  trade_date: '2025-03-28',
  nv: '0',
  foreign_tax_value_settlement_currency: '150',
  israel_tax_value_by_payments_settlement_currency: '100',
});

describe('collectHalfSecuritiesIncome', () => {
  it("books a dividend's gross and splits its withholding by the execution behind it", async () => {
    const { income, issues } = await collectHalfSecuritiesIncome(
      makeInjector({
        ledgerRecords: [dividendRecord],
        executions: [dividendExecution],
        transactionsByCharge: { charge: [{ id: 'transaction', origin_key: 'origin-key' }] },
        executionsByTransaction: { charge: { transaction: dividendExecution } },
      }),
      { ownerId: OWNER_ID, period: H1, adminContext: adminContext() },
    );

    expect(issues).toEqual([]);
    expect(income).toHaveLength(1);
    expect(income[0]).toMatchObject({
      id: 'record',
      kind: 'DIVIDEND',
      locality: 'FOREIGN',
      chargeId: 'charge',
      date: '2025-04-01',
      security: 'MOCK (US0000000001)',
      gross: 3700,
    });
    expect(income[0].foreignTaxWithheld).toBeCloseTo(555, 6);
    expect(income[0].israeliTaxWithheld).toBeCloseTo(370, 6);
  });

  it('takes untraced withholding by locality, and says so', async () => {
    const { income, issues } = await collectHalfSecuritiesIncome(
      makeInjector({ ledgerRecords: [dividendRecord] }),
      { ownerId: OWNER_ID, period: H1, adminContext: adminContext() },
    );

    expect(income[0].foreignTaxWithheld).toBe(925);
    expect(income[0].israeliTaxWithheld).toBe(0);
    expect(issues).toEqual([
      expect.objectContaining({
        chargeId: 'charge',
        message: expect.stringContaining('could not be traced to its execution'),
      }),
    ]);
  });

  it('reads interest off its own records, apart from dividends', async () => {
    const interestRecord = ledgerRecord({
      id: 'interest-record',
      credit_entity1: TAX_CATEGORIES.FOREIGN_BOND_INTEREST_INCOME,
      credit_local_amount1: '370',
      credit_foreign_amount1: '100',
      debit_local_amount1: '370',
      debit_foreign_amount1: '100',
    });

    const { income } = await collectHalfSecuritiesIncome(
      makeInjector({ ledgerRecords: [interestRecord] }),
      { ownerId: OWNER_ID, period: H1, adminContext: adminContext() },
    );

    expect(income).toEqual([
      expect.objectContaining({ kind: 'INTEREST', locality: 'FOREIGN', gross: 370 }),
    ]);
  });

  it('reports income the bank paid that no ledger record books', async () => {
    const { income, issues } = await collectHalfSecuritiesIncome(
      makeInjector({ executions: [dividendExecution] }),
      { ownerId: OWNER_ID, period: H1, adminContext: adminContext() },
    );

    expect(income).toEqual([]);
    expect(issues).toEqual([
      expect.objectContaining({
        executionId: 'dividend-execution',
        message: expect.stringContaining('No ledger record in the half books the dividend'),
      }),
    ]);
  });

  it('flags withholding that does not match its execution, and keeps to the ledger', async () => {
    // the ledger withheld 1,000; the execution's 250 at 3.70 is 925
    const record = ledgerRecord({
      ...dividendRecord,
      debit_local_amount1: '2700',
      debit_local_amount2: '1000',
    });

    const { income, issues } = await collectHalfSecuritiesIncome(
      makeInjector({
        ledgerRecords: [record],
        executions: [dividendExecution],
        transactionsByCharge: { charge: [{ id: 'transaction', origin_key: 'origin-key' }] },
        executionsByTransaction: { charge: { transaction: dividendExecution } },
      }),
      { ownerId: OWNER_ID, period: H1, adminContext: adminContext() },
    );

    expect(income[0].foreignTaxWithheld).toBeCloseTo(600, 6);
    expect(income[0].israeliTaxWithheld).toBeCloseTo(400, 6);
    expect(issues).toEqual([
      expect.objectContaining({
        executionId: 'dividend-execution',
        message: expect.stringContaining('(1000.00) does not match its execution\'s (925.00)'),
      }),
    ]);
  });

  it('nets a reversal out against the income it reverses', async () => {
    const paid = execution({
      ...dividendExecution,
      trade_gross_value_trade_currency: '1000',
      net_value_trade_currency: '750',
    });
    const cancellation = execution({
      ...paid,
      id: 'cancellation-execution',
      trade_date: '2025-04-08',
      is_cancel_transaction: 'כן',
      trade_gross_value_trade_currency: '-1000',
      net_value_trade_currency: '-750',
      foreign_tax_value_settlement_currency: '-150',
      israel_tax_value_by_payments_settlement_currency: '-100',
    });
    const reversal = ledgerRecord({
      id: 'reversal-record',
      charge_id: 'reversal-charge',
      invoice_date: '2025-04-10',
      reference1: 'reversal-origin-key',
      debit_entity1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME,
      debit_local_amount1: '3700',
      debit_foreign_amount1: '1000',
      credit_entity1: 'bank',
      credit_local_amount1: '2775',
      credit_foreign_amount1: '750',
      credit_entity2: TAX_CATEGORIES.FOREIGN_DIVIDEND_WITHHOLDING_TAX,
      credit_local_amount2: '925',
      credit_foreign_amount2: '250',
    });

    const { income, issues } = await collectHalfSecuritiesIncome(
      makeInjector({
        ledgerRecords: [dividendRecord, reversal],
        executions: [paid, cancellation],
        transactionsByCharge: {
          charge: [{ id: 'transaction', origin_key: 'origin-key' }],
          'reversal-charge': [{ id: 'reversal-transaction', origin_key: 'reversal-origin-key' }],
        },
        executionsByTransaction: {
          charge: { transaction: paid },
          'reversal-charge': { 'reversal-transaction': cancellation },
        },
      }),
      { ownerId: OWNER_ID, period: H1, adminContext: adminContext() },
    );

    expect(issues).toEqual([]);
    const total = (field: 'gross' | 'foreignTaxWithheld' | 'israeliTaxWithheld') =>
      income.reduce((sum, item) => sum + item[field], 0);
    expect(income.map(item => item.gross)).toEqual([3700, -3700]);
    expect(income[1].foreignTaxWithheld).toBeCloseTo(-555, 6);
    expect(total('gross')).toBe(0);
    expect(total('foreignTaxWithheld')).toBeCloseTo(0, 6);
    expect(total('israeliTaxWithheld')).toBeCloseTo(0, 6);
  });

  describe('dividends in kind', () => {
    const inKind = execution({
      id: 'in-kind-execution',
      trade_type: tradeTypeToRaw[SecurityTradeType.StockDistribution],
      payment_type: paymentTypeToRaw[SecurityPaymentType.DividendInKind],
      trade_date: '2025-03-20',
      nv: '3',
    });
    const bonusIssue = execution({
      id: 'bonus-execution',
      trade_type: tradeTypeToRaw[SecurityTradeType.StockDistribution],
      trade_date: '2025-03-21',
      nv: '5',
    });

    it('traces a dividend in kind through its charge', async () => {
      const record = ledgerRecord({
        id: 'in-kind-record',
        charge_id: 'in-kind-charge',
        reference1: null,
        credit_entity1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME,
        credit_local_amount1: '740',
        credit_foreign_amount1: '200',
        debit_entity1: 'securities',
        debit_local_amount1: '740',
        debit_foreign_amount1: '200',
      });

      const { income, issues } = await collectHalfSecuritiesIncome(
        makeInjector({
          ledgerRecords: [record],
          executions: [inKind, bonusIssue],
          distributionsByCharge: { 'in-kind-charge': [inKind] },
        }),
        { ownerId: OWNER_ID, period: H1, adminContext: adminContext() },
      );

      expect(issues).toEqual([]);
      expect(income).toEqual([
        expect.objectContaining({
          kind: 'DIVIDEND',
          locality: 'FOREIGN',
          gross: 740,
          security: 'MOCK (US0000000001)',
        }),
      ]);
    });

    it('reports a dividend in kind no ledger record books, but not a bonus issue', async () => {
      const { issues } = await collectHalfSecuritiesIncome(
        makeInjector({ executions: [inKind, bonusIssue] }),
        { ownerId: OWNER_ID, period: H1, adminContext: adminContext() },
      );

      expect(issues).toEqual([
        expect.objectContaining({
          executionId: 'in-kind-execution',
          message: expect.stringContaining('No ledger record in the half books the dividend'),
        }),
      ]);
    });
  });

  it('flags foreign tax withheld on a local dividend, which is not credited', async () => {
    const record = ledgerRecord({
      id: 'local-record',
      credit_entity1: TAX_CATEGORIES.LOCAL_DIVIDEND_INCOME,
      credit_local_amount1: '1000',
      debit_local_amount1: '750',
      debit_entity2: TAX_CATEGORIES.LOCAL_DIVIDEND_WITHHOLDING_TAX,
      debit_local_amount2: '250',
    });
    const localDividend = execution({
      id: 'local-dividend-execution',
      trade_type: tradeTypeToRaw[SecurityTradeType.DividendPayment],
      trade_date: '2025-03-28',
      isin: 'IL0000000001',
      trade_currency: 'שקל חדש',
      settlement_currency: 'שקל חדש',
      foreign_tax_value_settlement_currency: '50',
      israel_tax_value_by_payments_settlement_currency: '200',
    });

    const { income, issues } = await collectHalfSecuritiesIncome(
      makeInjector({
        ledgerRecords: [record],
        executions: [localDividend],
        transactionsByCharge: { charge: [{ id: 'transaction', origin_key: 'origin-key' }] },
        executionsByTransaction: { charge: { transaction: localDividend } },
      }),
      { ownerId: OWNER_ID, period: H1, adminContext: adminContext() },
    );

    expect(income[0]).toMatchObject({
      locality: 'LOCAL',
      foreignTaxWithheld: 50,
      israeliTaxWithheld: 200,
    });
    expect(issues).toEqual([
      expect.objectContaining({
        message: expect.stringContaining('Foreign tax was withheld on the local dividend'),
      }),
    ]);
  });

  it("blames an unset category only on income of that category's locality", async () => {
    const { FOREIGN_DIVIDEND_INCOME: _unset, ...categories } = TAX_CATEGORIES;
    const localDividend = execution({
      ...dividendExecution,
      id: 'local-dividend-execution',
      isin: 'IL0000000001',
    });

    const { issues } = await collectHalfSecuritiesIncome(
      makeInjector({ executions: [dividendExecution, localDividend] }),
      { ownerId: OWNER_ID, period: H1, adminContext: adminContext(categories) },
    );

    expect(issues).toEqual([
      expect.objectContaining({
        executionId: 'dividend-execution',
        message: expect.stringContaining('its income tax category is not set'),
      }),
      expect.objectContaining({
        executionId: 'local-dividend-execution',
        message: expect.stringContaining('No ledger record in the half books the dividend'),
      }),
    ]);
  });

  it('says when the income tax categories are not set', async () => {
    const { issues } = await collectHalfSecuritiesIncome(
      makeInjector({ executions: [dividendExecution] }),
      { ownerId: OWNER_ID, period: H1, adminContext: adminContext({}) },
    );

    expect(issues).toEqual([
      expect.objectContaining({
        message: expect.stringContaining('its income tax category is not set'),
      }),
    ]);
  });
});

describe('collectHalfSecuritiesExpenses', () => {
  const FEES = 'securities-fees';
  const CONSULTANCY = 'financial-consultancy';
  const expensesContext = adminContext({
    FOREIGN_SECURITIES_FEES: FEES,
    FINANCIAL_CONSULTANCY: CONSULTANCY,
  });

  it('totals what the ledger booked on the fees and consultancy categories, by category', async () => {
    const { expenses, issues } = await collectHalfSecuritiesExpenses(
      makeInjector({
        ledgerRecords: [
          ledgerRecord({ debit_entity1: FEES, debit_local_amount1: '120', credit_entity1: 'bank' }),
          ledgerRecord({ debit_entity1: FEES, debit_local_amount1: '30', credit_entity1: 'bank' }),
          // a refund of a fee
          ledgerRecord({ debit_entity1: 'bank', credit_entity1: FEES, credit_local_amount1: '20' }),
          ledgerRecord({
            debit_entity1: CONSULTANCY,
            debit_local_amount1: '1000',
            credit_entity1: 'supplier',
          }),
        ],
        taxCategoryNames: { [FEES]: 'Foreign Securities Fees', [CONSULTANCY]: 'Consultancy' },
      }),
      { ownerId: OWNER_ID, period: H1, adminContext: expensesContext },
    );

    expect(issues).toEqual([]);
    expect(expenses).toEqual([
      {
        key: 'FOREIGN_SECURITIES_FEES',
        taxCategoryId: FEES,
        name: 'Foreign Securities Fees',
        amount: 130,
      },
      {
        key: 'FINANCIAL_CONSULTANCY',
        taxCategoryId: CONSULTANCY,
        name: 'Consultancy',
        amount: 1000,
      },
    ]);
  });

  it('names a category the settings lack, so it can be set', async () => {
    const { expenses, issues } = await collectHalfSecuritiesExpenses(
      makeInjector({ ledgerRecords: [] }),
      { ownerId: OWNER_ID, period: H1, adminContext: adminContext({ FOREIGN_SECURITIES_FEES: FEES }) },
    );

    expect(expenses.map(expense => expense.key)).toEqual(['FOREIGN_SECURITIES_FEES']);
    expect(issues).toEqual([
      expect.objectContaining({ missingTaxCategory: 'FINANCIAL_CONSULTANCY' }),
    ]);
  });
});
