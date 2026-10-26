import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SecuritiesTaxCategoryKey } from '../../../../../__generated__/types.js';
import { TEST_TIMEZONES, useTimezone } from '../../../../../__tests__/helpers/timezones.js';
import { Currency } from '../../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../../admin-context/providers/admin-context.provider.js';
import { getChargeBusinesses } from '../../../../charges/helpers/common.helper.js';
import type { IGetChargesByIdsResult } from '../../../../charges/types.js';
import { ExchangeProvider } from '../../../../exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '../../../../financial-accounts/providers/financial-accounts.provider.js';
import { FinancialEntitiesProvider } from '../../../../financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../../../../financial-entities/providers/tax-categories.provider.js';
import { ForeignSecuritiesProvider } from '../../../../foreign-securities/providers/foreign-securities.provider.js';
import type { SecurityExecutionRow } from '../../../../foreign-securities/types.js';
import { MiscExpensesProvider } from '../../../../misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '../../../../transactions/providers/transactions.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../../transactions/types.js';
import type { IGetLedgerRecordsByChargesIdsResult } from '../../../types.js';
import { generateLedgerRecordsForForeignSecurities } from '../foreign-securities-ledger-generation.resolver.js';
import {
  buildTransaction as buildMockTransaction,
  expectGeneratedRecords,
  makeExchangeProvider,
  makeFinancialEntitiesProvider,
  makeInjector as makeMockInjector,
  type MockRate,
  type TransactionInput,
} from './helpers/ledger-generation-mocks.js';

vi.mock('../../../../charges/helpers/common.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../../charges/helpers/common.helper.js')>()),
  getChargeBusinesses: vi.fn(),
}));

/*
 * A foreign-securities charge: cash movements in the owner's bank account, each the cash leg of an
 * execution in the securities portfolio (a buy, a sale, a dividend, a bond coupon, a redemption).
 *
 * The base entry books the bank account against the securities account. Income and redemptions are
 * reshaped from it once the matched execution says what the movement was:
 *  - dividends and bond interest are credited to (local or foreign) income, with any tax withheld
 *    debited to a withholding-tax category;
 *  - a redemption credits the securities account with the FIFO purchase cost and books the
 *    difference as a gain or a loss.
 *
 * All IDs, amounts, rates and dates below are made up.
 */

const CHARGE_ID = 'charge-foreign-securities';
const OWNER_ID = 'owner-business';

const BANK_ACCOUNT_ID = 'account-bank';
const SECURITIES_ACCOUNT_ID = 'account-foreign-securities';
const SECURITY_BUSINESS_ID = 'business-security';
const BANK_BUSINESS_ID = 'business-bank';

const FEES_TAX_CATEGORY_ID = 'tax-category-securities-fees';

const TAX_CATEGORIES: Record<SecuritiesTaxCategoryKey, string> = {
  FOREIGN_SECURITIES_FEES: FEES_TAX_CATEGORY_ID,
  FOREIGN_DIVIDEND_INCOME: 'tax-category-foreign-dividend-income',
  LOCAL_DIVIDEND_INCOME: 'tax-category-local-dividend-income',
  FOREIGN_DIVIDEND_WITHHOLDING_TAX: 'tax-category-foreign-dividend-withholding-tax',
  LOCAL_DIVIDEND_WITHHOLDING_TAX: 'tax-category-local-dividend-withholding-tax',
  FOREIGN_BOND_INTEREST_INCOME: 'tax-category-foreign-bond-interest-income',
  LOCAL_BOND_INTEREST_INCOME: 'tax-category-local-bond-interest-income',
  FOREIGN_BOND_WITHHOLDING_TAX: 'tax-category-foreign-bond-withholding-tax',
  LOCAL_BOND_WITHHOLDING_TAX: 'tax-category-local-bond-withholding-tax',
  FOREIGN_SECURITIES_SALE_GAIN: 'tax-category-foreign-securities-gain',
  FOREIGN_SECURITIES_SALE_LOSS: 'tax-category-foreign-securities-loss',
};

const DAY: TimelessDateString = '2025-03-12';
const USD_RATE = 3.5;
/** A later day at another rate, for a payment cancelled after it was made */
const LATER_DAY: TimelessDateString = '2025-03-19';
const LATER_USD_RATE = 3.6;
const RATES: MockRate[] = [
  [Currency.Usd, DAY, USD_RATE],
  [Currency.Usd, LATER_DAY, LATER_USD_RATE],
];

const USD_LABEL = 'דולר ארה"ב';
const ILS_LABEL = 'שקל חדש';

/** The tax category the ledger books a financial account's movements in a currency to */
function accountTaxCategoryId(accountId: string, currency: Currency): string {
  return `tax-category:${accountId}:${currency}`;
}

const BANK_USD = accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Usd);
const BANK_ILS = accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Ils);
const SECURITIES_USD = accountTaxCategoryId(SECURITIES_ACCOUNT_ID, Currency.Usd);
const SECURITIES_ILS = accountTaxCategoryId(SECURITIES_ACCOUNT_ID, Currency.Ils);

function buildTransaction(
  input: Partial<Omit<TransactionInput, 'chargeId' | 'ownerId'>> &
    Pick<TransactionInput, 'id' | 'amount'>,
): IGetTransactionsByChargeIdsResult {
  return buildMockTransaction({
    accountId: BANK_ACCOUNT_ID,
    businessId: SECURITY_BUSINESS_ID,
    currency: Currency.Usd,
    debitDate: DAY,
    description: `securities payment ${input.id}`,
    ...input,
    chargeId: CHARGE_ID,
    ownerId: OWNER_ID,
  });
}

/** The separate fee the bank charges in shekels for collecting a payment */
const feeTransaction = buildTransaction({
  id: 'transaction-fee',
  amount: '-25',
  currency: Currency.Ils,
  businessId: BANK_BUSINESS_ID,
  isFee: true,
  description: 'securities payment fee',
});

const TRADE_TYPES = {
  buy: 'קניה',
  sell: 'מכירה',
  dividend: 'דבידנד תשלום',
  interest: 'ריבית תשלום',
  redemption: 'פדיון',
} as const;

function buildExecution(
  overrides: Partial<SecurityExecutionRow> & Pick<SecurityExecutionRow, 'id' | 'trade_type'>,
): SecurityExecutionRow {
  return {
    owner_id: OWNER_ID,
    security: '7654321',
    bank_number: 12,
    branch_number: 600,
    account_number: 123456,
    trade_date: DAY,
    value_date: DAY,
    settlement_date: DAY,
    payment_date: null,
    transaction_type: 'תשלומים ואירועי חברה',
    nv: '0',
    trade_price: '0',
    trade_gross_value_trade_currency: '1000',
    net_value_trade_currency: '1000',
    net_value_settlement_currency: '1000',
    net_value_nis: '3500',
    trade_currency: USD_LABEL,
    settlement_currency: USD_LABEL,
    // the bank charges it as a separate fee transaction, never out of the payment itself
    trade_commission_value_trade_currency: '7',
    management_fees_value_trade_currency: '0',
    israe_tax_value: '0',
    nominal_profit_loss_nis: '0',
    real_profit_loss_nis: '0',
    payment_type: null,
    symbol: 'MOCK',
    isin: 'US0000000001',
    issuer_country_code: 'US',
    foreign_tax_value_settlement_currency: '0',
    israel_tax_value_by_payments_settlement_currency: '0',
    capital_tax_value_settlement_currency: '0',
    is_cancel_transaction: 'לא',
    ...overrides,
  } as SecurityExecutionRow;
}

/** A purchase lot in the redemption's history */
function buyExecution(id: string, tradeDate: TimelessDateString, units: number, cost: number) {
  return buildExecution({
    id,
    trade_type: TRADE_TYPES.buy,
    transaction_type: TRADE_TYPES.buy,
    trade_date: tradeDate,
    value_date: tradeDate,
    nv: String(units),
    trade_gross_value_trade_currency: String(cost),
    net_value_trade_currency: String(-cost),
    net_value_settlement_currency: String(-cost),
    net_value_nis: String(-cost * USD_RATE),
  });
}

function redemptionExecution(
  units: number,
  netProceeds: number,
  overrides: Partial<SecurityExecutionRow> = {},
) {
  return buildExecution({
    id: 'execution-redemption',
    trade_type: TRADE_TYPES.redemption,
    payment_type: 'פידיון',
    nv: String(units),
    trade_gross_value_trade_currency: String(netProceeds),
    net_value_trade_currency: String(netProceeds),
    net_value_settlement_currency: String(netProceeds),
    net_value_nis: String(netProceeds * USD_RATE),
    ...overrides,
  });
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
  tax_category_id: null,
  type: 'FOREIGN_SECURITIES',
  updated_at: new Date('2025-03-14T00:00:00.000Z'),
  user_description: null,
};

type Scenario = {
  transactions: IGetTransactionsByChargeIdsResult[];
  /** The execution each transaction is matched to, by transaction id */
  executions?: Record<string, SecurityExecutionRow>;
  /** The ingested history of the security, for redemptions */
  history?: SecurityExecutionRow[];
  /** Securities tax categories configured for the tenant; defaults to all of them */
  taxCategories?: Partial<Record<SecuritiesTaxCategoryKey, string>>;
  /** Executions with no cash leg that the charge books directly */
  distributions?: SecurityExecutionRow[];
  /**
   * Whether a lookup by account number resolves another in-scope business's securities account,
   * which the owner-scoped lookups must not book to
   */
  otherBusinessAccountByNumber?: boolean;
  /** Entities the balance check treats as businesses; defaults to the bank only */
  businessIds?: string[];
};

function makeInjector(scenario: Scenario) {
  const foreignSecuritiesProvider = {
    getChargeExecutionsByTransactionId: vi.fn(
      async () => new Map(Object.entries(scenario.executions ?? {})),
    ),
    getSecurityAccountHistory: vi.fn(async () => scenario.history ?? []),
    executionsByChargeIdLoader: { load: vi.fn(async () => scenario.distributions ?? []) },
  };

  const injector = makeMockInjector(
    new Map<unknown, unknown>([
      [
        AdminContextProvider,
        {
          getVerifiedAdminContext: async () => ({
            ownerId: OWNER_ID,
            defaultLocalCurrency: Currency.Ils,
            locality: 'ISR',
            foreignSecurities: {
              foreignSecuritiesBusinessId: null,
              foreignSecuritiesFeesCategoryId: (scenario.taxCategories ?? TAX_CATEGORIES)
                .FOREIGN_SECURITIES_FEES,
              sortCode: null,
              taxCategories: scenario.taxCategories ?? TAX_CATEGORIES,
            },
            financialAccounts: {
              // the security business stands in for the securities account
              internalWalletsIds: [SECURITY_BUSINESS_ID],
              swiftBusinessId: null,
            },
          }),
        },
      ],
      [
        TransactionsProvider,
        { transactionsByChargeIDLoader: { load: async () => scenario.transactions } },
      ],
      [
        FinancialAccountsProvider,
        {
          getFinancialAccountsByOwnerIdLoader: {
            load: async () => [
              { id: BANK_ACCOUNT_ID, type: 'BANK_ACCOUNT' },
              { id: SECURITIES_ACCOUNT_ID, type: 'FOREIGN_SECURITIES' },
            ],
          },
          getFinancialAccountByAccountNumberLoader: {
            load: async (accountNumber: string) =>
              accountNumber === 'foreign_securities'
                ? {
                    id: scenario.otherBusinessAccountByNumber
                      ? 'account-other-business-securities'
                      : SECURITIES_ACCOUNT_ID,
                  }
                : null,
          },
        },
      ],
      [ExchangeProvider, makeExchangeProvider(RATES)],
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
      [
        FinancialEntitiesProvider,
        makeFinancialEntitiesProvider(scenario.businessIds ?? [BANK_BUSINESS_ID]),
      ],
      [ForeignSecuritiesProvider, foreignSecuritiesProvider],
    ]),
  );

  return { injector, foreignSecuritiesProvider };
}

async function generate(scenario: Scenario) {
  const { injector, foreignSecuritiesProvider } = makeInjector(scenario);
  const result = await generateLedgerRecordsForForeignSecurities(
    charge as never,
    { insertLedgerRecordsIfNotExists: false },
    { injector } as never,
    {} as never,
  );
  return { ...expectGeneratedRecords(result as never), foreignSecuritiesProvider };
}

function round(value: string | null | undefined): number | null {
  return value == null ? null : Math.round(Number(value) * 1e6) / 1e6;
}

/** Both account slots of each side, with amounts rounded off float noise */
function summarize(record: IGetLedgerRecordsByChargesIdsResult) {
  return {
    currency: record.currency,
    debit1: record.debit_entity1,
    debitForeign1: round(record.debit_foreign_amount1),
    debitLocal1: round(record.debit_local_amount1),
    debit2: record.debit_entity2,
    debitForeign2: round(record.debit_foreign_amount2),
    debitLocal2: round(record.debit_local_amount2),
    credit1: record.credit_entity1,
    creditForeign1: round(record.credit_foreign_amount1),
    creditLocal1: round(record.credit_local_amount1),
    credit2: record.credit_entity2,
    creditForeign2: round(record.credit_foreign_amount2),
    creditLocal2: round(record.credit_local_amount2),
  };
}

/** A one-sided USD record line: entity, foreign amount, and its value at the day's rate */
function usd(amount: number) {
  return { foreign: amount, local: Math.round(amount * USD_RATE * 1e6) / 1e6 };
}

function recordOf(records: IGetLedgerRecordsByChargesIdsResult[], debitOrCredit: string) {
  return records.find(
    record => record.debit_entity1 === debitOrCredit || record.credit_entity1 === debitOrCredit,
  );
}

/** Each entity's balance across the records, in foreign or local amounts: debits less credits */
function netByEntity(records: IGetLedgerRecordsByChargesIdsResult[], amounts: 'foreign' | 'local') {
  const net = new Map<string, number>();
  const add = (entity: string | null, amount: string | null, sign: 1 | -1) => {
    if (entity && amount != null) {
      net.set(entity, (net.get(entity) ?? 0) + sign * Number(amount));
    }
  };
  for (const record of records) {
    add(record.debit_entity1, record[`debit_${amounts}_amount1`], 1);
    add(record.debit_entity2, record[`debit_${amounts}_amount2`], 1);
    add(record.credit_entity1, record[`credit_${amounts}_amount1`], -1);
    add(record.credit_entity2, record[`credit_${amounts}_amount2`], -1);
  }
  return net;
}

/** What a cash-in movement looks like before this change, and still does when it can't be improved */
function baseCashInRecord(amount: number) {
  return {
    currency: Currency.Usd,
    debit1: BANK_USD,
    debitForeign1: usd(amount).foreign,
    debitLocal1: usd(amount).local,
    debit2: null,
    debitForeign2: null,
    debitLocal2: null,
    credit1: SECURITIES_USD,
    creditForeign1: usd(amount).foreign,
    creditLocal1: usd(amount).local,
    credit2: null,
    creditForeign2: null,
    creditLocal2: null,
  };
}

describe.each(TEST_TIMEZONES)('generateLedgerRecordsForForeignSecurities (TZ=%s)', timeZone => {
  useTimezone(timeZone);

  beforeEach(() => {
    vi.mocked(getChargeBusinesses).mockResolvedValue({
      mainBusinessId: SECURITY_BUSINESS_ID,
    } as never);
  });

  describe('execution matching', () => {
    it('keeps the base entry and reports a transaction with no matched execution', async () => {
      const transaction = buildTransaction({ id: 'transaction-unmatched', amount: '1000' });

      const { records, errors } = await generate({ transactions: [transaction] });

      expect(records.map(summarize)).toEqual([baseCashInRecord(1000)]);
      expect(errors).toEqual([
        expect.stringContaining('no matched security execution'),
      ]);
      expect(errors[0]).toContain('securities payment transaction-unmatched');
      expect(errors[0]).toContain(DAY);
    });

    it('asks the provider for the executions of this charge', async () => {
      const transaction = buildTransaction({ id: 'transaction-1', amount: '1000' });

      const { foreignSecuritiesProvider } = await generate({ transactions: [transaction] });

      expect(foreignSecuritiesProvider.getChargeExecutionsByTransactionId).toHaveBeenCalledWith(
        CHARGE_ID,
        OWNER_ID,
      );
    });
  });

  describe('buys and sales are unchanged', () => {
    it('books a buy against the securities account', async () => {
      const transaction = buildTransaction({ id: 'transaction-buy', amount: '-1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: buyExecution('execution-buy', DAY, 10, 1000),
        },
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([
        {
          ...baseCashInRecord(1000),
          debit1: SECURITIES_USD,
          credit1: BANK_USD,
        },
      ]);
    });

    it('books a sale (also of a bond before its redemption) against the securities account', async () => {
      const transaction = buildTransaction({ id: 'transaction-sell', amount: '1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: buildExecution({
            id: 'execution-sell',
            trade_type: TRADE_TYPES.sell,
            transaction_type: TRADE_TYPES.sell,
            nv: '10',
          }),
        },
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([baseCashInRecord(1000)]);
    });
  });

  describe('a charge spanning several securities', () => {
    it('lets every bought security keep its holding balance', async () => {
      // two security businesses that are not internal wallets, so each trade is booked against
      // its own security rather than the securities account
      const alpha = 'business-security-alpha';
      const beta = 'business-security-beta';
      vi.mocked(getChargeBusinesses).mockResolvedValue({ mainBusinessId: null } as never);
      const buyAlpha = buildTransaction({ id: 'transaction-buy-alpha', amount: '-1000', businessId: alpha });
      const buyBeta = buildTransaction({ id: 'transaction-buy-beta', amount: '-1000', businessId: beta });

      const { records, errors } = await generate({
        transactions: [buyBeta, buyAlpha],
        executions: {
          [buyAlpha.id]: buyExecution('execution-buy-alpha', DAY, 10, 1000),
          [buyBeta.id]: buyExecution('execution-buy-beta', DAY, 10, 1000),
        },
        businessIds: [BANK_BUSINESS_ID, alpha, beta],
      });

      expect(errors).toEqual([]);
      // in the transactions' order, not the order their lookups happened to finish in
      expect(records.map(record => record.debit_entity1)).toEqual([beta, alpha]);
    });

    it('reports a security sold beyond what the charge bought', async () => {
      const alpha = 'business-security-alpha';
      vi.mocked(getChargeBusinesses).mockResolvedValue({ mainBusinessId: null } as never);
      const buyAlpha = buildTransaction({
        id: 'transaction-buy-alpha',
        amount: '-1000',
        businessId: alpha,
      });
      const sellAlpha = buildTransaction({
        id: 'transaction-sell-alpha',
        amount: '1500',
        businessId: alpha,
      });

      const { errors } = await generate({
        transactions: [buyAlpha, sellAlpha],
        executions: {
          [buyAlpha.id]: buyExecution('execution-buy-alpha', DAY, 10, 1000),
          [sellAlpha.id]: buildExecution({
            id: 'execution-sell-alpha',
            trade_type: TRADE_TYPES.sell,
            transaction_type: TRADE_TYPES.sell,
            nv: '10',
            net_value_trade_currency: '1500',
          }),
        },
        businessIds: [BANK_BUSINESS_ID, alpha],
      });

      // it took part in a buy, but its balance across the charge is a credit, not a holding
      expect(errors).toEqual([expect.stringContaining(`Business "${alpha}" is unbalanced`)]);
    });
  });

  describe('dividends', () => {
    const dividendExecution = (overrides: Partial<SecurityExecutionRow> = {}) =>
      buildExecution({
        id: 'execution-dividend',
        trade_type: TRADE_TYPES.dividend,
        payment_type: 'דיבידנד',
        ...overrides,
      });

    it('credits foreign dividend income when nothing was withheld, leaving the fee as is', async () => {
      const transaction = buildTransaction({ id: 'transaction-dividend', amount: '1000' });

      const { records, errors, missingSecuritiesTaxCategories } = await generate({
        transactions: [transaction, feeTransaction],
        executions: { [transaction.id]: dividendExecution() },
      });

      expect(errors).toEqual([]);
      expect(missingSecuritiesTaxCategories ?? []).toEqual([]);
      expect(summarize(recordOf(records, BANK_USD)!)).toEqual({
        ...baseCashInRecord(1000),
        credit1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME,
      });
      expect(summarize(recordOf(records, FEES_TAX_CATEGORY_ID)!)).toMatchObject({
        currency: Currency.Ils,
        debit1: FEES_TAX_CATEGORY_ID,
        debitLocal1: 25,
        credit1: BANK_ILS,
        creditLocal1: 25,
      });
    });

    it('credits local dividend income for an Israeli issuer', async () => {
      const transaction = buildTransaction({ id: 'transaction-dividend', amount: '1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: dividendExecution({ issuer_country_code: 'IL', isin: 'IL0000000001' }),
        },
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([
        { ...baseCashInRecord(1000), credit1: TAX_CATEGORIES.LOCAL_DIVIDEND_INCOME },
      ]);
    });

    it('books withheld tax as a second debit and the gross amount as income', async () => {
      // 1,250 declared, 250 withheld abroad, 1,000 received
      const transaction = buildTransaction({ id: 'transaction-dividend', amount: '1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: dividendExecution({
            trade_gross_value_trade_currency: '1250',
            foreign_tax_value_settlement_currency: '250',
          }),
        },
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([
        {
          currency: Currency.Usd,
          debit1: BANK_USD,
          debitForeign1: usd(1000).foreign,
          debitLocal1: usd(1000).local,
          debit2: TAX_CATEGORIES.FOREIGN_DIVIDEND_WITHHOLDING_TAX,
          debitForeign2: usd(250).foreign,
          debitLocal2: usd(250).local,
          credit1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME,
          creditForeign1: usd(1250).foreign,
          creditLocal1: usd(1250).local,
          credit2: null,
          creditForeign2: null,
          creditLocal2: null,
        },
      ]);
    });

    it('books a refund of withheld tax as a second credit', async () => {
      // 950 declared, 50 of earlier withholding refunded, 1,000 received
      const transaction = buildTransaction({ id: 'transaction-dividend', amount: '1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: dividendExecution({
            trade_gross_value_trade_currency: '950',
            israel_tax_value_by_payments_settlement_currency: '-50',
          }),
        },
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([
        {
          ...baseCashInRecord(1000),
          credit1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME,
          creditForeign1: usd(950).foreign,
          creditLocal1: usd(950).local,
          credit2: TAX_CATEGORIES.FOREIGN_DIVIDEND_WITHHOLDING_TAX,
          creditForeign2: usd(50).foreign,
          creditLocal2: usd(50).local,
        },
      ]);
    });

    it('books tax withheld on a local dividend to local dividend withholding tax, with no foreign amounts in shekels', async () => {
      const transaction = buildTransaction({
        id: 'transaction-dividend',
        amount: '400',
        currency: Currency.Ils,
      });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: dividendExecution({
            issuer_country_code: 'IL',
            isin: 'IL0000000001',
            trade_currency: ILS_LABEL,
            settlement_currency: ILS_LABEL,
            trade_gross_value_trade_currency: '500',
            net_value_trade_currency: '400',
            net_value_settlement_currency: '400',
            net_value_nis: '400',
            israel_tax_value_by_payments_settlement_currency: '100',
          }),
        },
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([
        {
          currency: Currency.Ils,
          debit1: BANK_ILS,
          debitForeign1: null,
          debitLocal1: 400,
          debit2: TAX_CATEGORIES.LOCAL_DIVIDEND_WITHHOLDING_TAX,
          debitForeign2: null,
          debitLocal2: 100,
          credit1: TAX_CATEGORIES.LOCAL_DIVIDEND_INCOME,
          creditForeign1: null,
          creditLocal1: 500,
          credit2: null,
          creditForeign2: null,
          creditLocal2: null,
        },
      ]);
      expect(records[0].credit_entity1).not.toBe(SECURITIES_ILS);
    });

    it('books Israeli tax once when the bank restates it as capital tax', async () => {
      const transaction = buildTransaction({ id: 'transaction-dividend', amount: '1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: dividendExecution({
            trade_gross_value_trade_currency: '1250',
            israel_tax_value_by_payments_settlement_currency: '250',
            capital_tax_value_settlement_currency: '250',
          }),
        },
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([
        {
          ...baseCashInRecord(1000),
          debit2: TAX_CATEGORIES.FOREIGN_DIVIDEND_WITHHOLDING_TAX,
          debitForeign2: usd(250).foreign,
          debitLocal2: usd(250).local,
          credit1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME,
          creditForeign1: usd(1250).foreign,
          creditLocal1: usd(1250).local,
        },
      ]);
    });

    it('keeps the base entry and names a missing income category', async () => {
      const transaction = buildTransaction({ id: 'transaction-dividend', amount: '1000' });
      const { FOREIGN_DIVIDEND_INCOME: _, ...taxCategories } = TAX_CATEGORIES;

      const { records, errors, missingSecuritiesTaxCategories } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: dividendExecution() },
        taxCategories,
      });

      expect(records.map(summarize)).toEqual([baseCashInRecord(1000)]);
      expect(errors).toEqual([
        expect.stringContaining('Missing securities tax category "Foreign dividend income"'),
      ]);
      expect(missingSecuritiesTaxCategories).toEqual(['FOREIGN_DIVIDEND_INCOME']);
    });

    it('names a missing withholding category only when tax was withheld', async () => {
      const transaction = buildTransaction({ id: 'transaction-dividend', amount: '1000' });
      const { FOREIGN_DIVIDEND_WITHHOLDING_TAX: _, ...taxCategories } = TAX_CATEGORIES;

      const withoutTax = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: dividendExecution() },
        taxCategories,
      });
      expect(withoutTax.errors).toEqual([]);
      expect(withoutTax.records[0].credit_entity1).toBe(TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME);

      const withTax = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: dividendExecution({
            trade_gross_value_trade_currency: '1250',
            foreign_tax_value_settlement_currency: '250',
          }),
        },
        taxCategories,
      });
      expect(withTax.records.map(summarize)).toEqual([baseCashInRecord(1000)]);
      expect(withTax.errors).toEqual([
        expect.stringContaining('Missing securities tax category "Foreign dividend withholding tax"'),
      ]);
      expect(withTax.missingSecuritiesTaxCategories).toEqual(['FOREIGN_DIVIDEND_WITHHOLDING_TAX']);
    });

    it('books the reported tax and reports it when gross minus net disagrees', async () => {
      const transaction = buildTransaction({ id: 'transaction-dividend', amount: '1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: dividendExecution({ trade_gross_value_trade_currency: '1010' }),
        },
      });

      expect(records.map(summarize)).toEqual([
        { ...baseCashInRecord(1000), credit1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME },
      ]);
      expect(errors).toEqual([expect.stringContaining('does not match gross minus net')]);
    });

    it('books a cancelled dividend as the mirror of its income entry, crediting its tax back', async () => {
      // the bank reverses a 1,250 dividend that paid 1,000 after 250 withheld: its gross stays
      // positive, while the cash and the tax come back negated
      const transaction = buildTransaction({ id: 'transaction-cancellation', amount: '-1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: dividendExecution({
            trade_gross_value_trade_currency: '1250',
            net_value_trade_currency: '-1000',
            net_value_settlement_currency: '-1000',
            foreign_tax_value_settlement_currency: '-250',
            is_cancel_transaction: 'כן',
          }),
        },
      });

      // the dividend it cancels is not in the charge, which is the fallback's business below
      expect(errors).toEqual([expect.stringContaining('that is not in this charge')]);
      expect(records.map(summarize)).toEqual([
        {
          currency: Currency.Usd,
          debit1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME,
          debitForeign1: usd(1250).foreign,
          debitLocal1: usd(1250).local,
          debit2: null,
          debitForeign2: null,
          debitLocal2: null,
          credit1: BANK_USD,
          creditForeign1: usd(1000).foreign,
          creditLocal1: usd(1000).local,
          credit2: TAX_CATEGORIES.FOREIGN_DIVIDEND_WITHHOLDING_TAX,
          creditForeign2: usd(250).foreign,
          creditLocal2: usd(250).local,
        },
      ]);
    });

    it('nets a cancelled and re-executed dividend down to the replacement, at the original rate', async () => {
      // a 1,250 dividend (250 withheld) is cancelled a week later, at another rate, and paid again
      // as 1,240 (248 withheld)
      const original = buildTransaction({ id: 'transaction-original', amount: '1000' });
      const cancellation = buildTransaction({
        id: 'transaction-cancellation',
        amount: '-1000',
        debitDate: LATER_DAY,
      });
      const replacement = buildTransaction({
        id: 'transaction-replacement',
        amount: '992',
        debitDate: LATER_DAY,
      });

      const { records, errors } = await generate({
        transactions: [original, cancellation, replacement],
        executions: {
          [original.id]: dividendExecution({
            id: 'execution-original',
            trade_gross_value_trade_currency: '1250',
            foreign_tax_value_settlement_currency: '250',
          }),
          [cancellation.id]: dividendExecution({
            id: 'execution-cancellation',
            trade_date: LATER_DAY,
            value_date: LATER_DAY,
            trade_gross_value_trade_currency: '1250',
            net_value_trade_currency: '-1000',
            net_value_settlement_currency: '-1000',
            foreign_tax_value_settlement_currency: '-250',
            is_cancel_transaction: 'כן',
          }),
          [replacement.id]: dividendExecution({
            id: 'execution-replacement',
            trade_date: LATER_DAY,
            value_date: LATER_DAY,
            trade_gross_value_trade_currency: '1240',
            net_value_trade_currency: '992',
            net_value_settlement_currency: '992',
            foreign_tax_value_settlement_currency: '248',
          }),
        },
      });

      expect(errors).toEqual([]);

      // the reversal is booked on its own day, at the rate of the dividend it cancels
      const reversal = records.find(
        record => record.debit_entity1 === TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME,
      )!;
      expect(reversal.value_date).toBe(LATER_DAY);
      expect(summarize(reversal)).toMatchObject({
        debitLocal1: usd(1250).local,
        creditLocal1: usd(1000).local,
        creditLocal2: usd(250).local,
      });

      const foreign = netByEntity(records, 'foreign');
      expect(foreign.get(BANK_USD)).toBeCloseTo(992);
      expect(foreign.get(TAX_CATEGORIES.FOREIGN_DIVIDEND_WITHHOLDING_TAX)).toBeCloseTo(248);
      expect(foreign.get(TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME)).toBeCloseTo(-1240);
      expect(foreign.has(SECURITIES_USD)).toBe(false);

      // income and withheld tax are left with the replacement's, at its rate, and nothing else
      const local = netByEntity(records, 'local');
      expect(local.get(TAX_CATEGORIES.FOREIGN_DIVIDEND_WITHHOLDING_TAX)).toBeCloseTo(
        248 * LATER_USD_RATE,
        6,
      );
      expect(local.get(TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME)).toBeCloseTo(
        -1240 * LATER_USD_RATE,
        6,
      );
    });

    it('prices a cancellation at its own rate, and says so, when the dividend it cancels is not in the charge', async () => {
      const cancellation = buildTransaction({
        id: 'transaction-cancellation',
        amount: '-1000',
        debitDate: LATER_DAY,
      });

      const { records, errors } = await generate({
        transactions: [cancellation],
        executions: {
          [cancellation.id]: dividendExecution({
            trade_date: LATER_DAY,
            value_date: LATER_DAY,
            trade_gross_value_trade_currency: '1250',
            net_value_trade_currency: '-1000',
            net_value_settlement_currency: '-1000',
            foreign_tax_value_settlement_currency: '-250',
            is_cancel_transaction: 'כן',
          }),
        },
      });

      expect(errors).toEqual([
        expect.stringContaining(
          "cancels a dividend of MOCK (US0000000001) that is not in this charge, so its reversal is priced at the cancellation day's rate",
        ),
      ]);
      expect(records.map(summarize)).toEqual([
        expect.objectContaining({
          debit1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME,
          debitLocal1: 1250 * LATER_USD_RATE,
          credit1: BANK_USD,
          creditLocal1: 1000 * LATER_USD_RATE,
          credit2: TAX_CATEGORIES.FOREIGN_DIVIDEND_WITHHOLDING_TAX,
          creditLocal2: 250 * LATER_USD_RATE,
        }),
      ]);
    });

    it('keeps the base entry of a cancellation whose cash came in, and says why', async () => {
      const transaction = buildTransaction({ id: 'transaction-cancellation', amount: '1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: dividendExecution({ is_cancel_transaction: 'כן' }),
        },
      });

      expect(records.map(summarize)).toEqual([baseCashInRecord(1000)]);
      expect(errors).toEqual([
        expect.stringContaining('Expected money going out for the cancellation'),
      ]);
    });

    describe('commission', () => {
      /** The commission fee, which the bank keys to the security in its reference */
      const commissionFee = (
        amount: string,
        id = 'transaction-commission',
        description = "ניעז עמ' תשלום FSEC PYMNT FEE",
      ) => ({
        ...buildTransaction({
          id,
          amount,
          currency: Currency.Ils,
          businessId: BANK_BUSINESS_ID,
          isFee: true,
          description,
        }),
        source_reference: '7654321',
      });
      const dividendWithCommission = () =>
        dividendExecution({
          commissions_currency: ILS_LABEL,
          trade_commission_value_nis: '25',
        });

      it('accepts a commission the charge has a matching fee for', async () => {
        const transaction = buildTransaction({ id: 'transaction-dividend', amount: '1000' });

        const { errors } = await generate({
          transactions: [transaction, commissionFee('-25')],
          executions: { [transaction.id]: dividendWithCommission() },
        });

        expect(errors).toEqual([]);
      });

      it('reports a commission the charge has no fee for', async () => {
        const transaction = buildTransaction({ id: 'transaction-dividend', amount: '1000' });

        const { records, errors } = await generate({
          transactions: [transaction],
          executions: { [transaction.id]: dividendWithCommission() },
        });

        expect(records.map(summarize)).toEqual([
          { ...baseCashInRecord(1000), credit1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME },
        ]);
        expect(errors).toEqual([
          'A commission of 25.00 ILS was reported for MOCK (US0000000001), but the charge has no fee transaction for it',
        ]);
      });

      it('counts the fee of a non-income execution of the same security', async () => {
        const dividend = buildTransaction({ id: 'transaction-dividend', amount: '1000' });
        const sale = buildTransaction({ id: 'transaction-sale', amount: '2000' });

        const { errors } = await generate({
          transactions: [dividend, sale, commissionFee('-25'), commissionFee('-14', 'transaction-sale-commission')],
          executions: {
            [dividend.id]: dividendWithCommission(),
            [sale.id]: buildExecution({
              id: 'execution-sale',
              trade_type: TRADE_TYPES.sell,
              transaction_type: TRADE_TYPES.sell,
              net_value_trade_currency: '2000',
              net_value_settlement_currency: '2000',
              commissions_currency: ILS_LABEL,
              trade_commission_value_nis: '14',
            }),
          },
        });

        expect(errors).toEqual([]);
      });

      it('does not report a commission mismatch of trades alone', async () => {
        const sale = buildTransaction({ id: 'transaction-sale', amount: '2000' });

        const { errors } = await generate({
          transactions: [sale],
          executions: {
            [sale.id]: buildExecution({
              id: 'execution-sale',
              trade_type: TRADE_TYPES.sell,
              transaction_type: TRADE_TYPES.sell,
              net_value_trade_currency: '2000',
              net_value_settlement_currency: '2000',
              commissions_currency: ILS_LABEL,
              trade_commission_value_nis: '14',
            }),
          },
        });

        expect(errors).toEqual([]);
      });

      it('counts the refunded commission of a cancelled and re-executed dividend', async () => {
        // a dividend charged 25 is cancelled, its commission refunded, and paid again for 24.80
        const original = buildTransaction({ id: 'transaction-original', amount: '1000' });
        const cancellation = buildTransaction({ id: 'transaction-cancellation', amount: '-1000' });
        const replacement = buildTransaction({ id: 'transaction-replacement', amount: '992' });

        const { errors } = await generate({
          transactions: [
            original,
            cancellation,
            replacement,
            commissionFee('-25', 'transaction-original-commission'),
            commissionFee('25', 'transaction-commission-refund', 'ביטול עמלה ני"ע CANC SEC FEE'),
            commissionFee('-24.80', 'transaction-replacement-commission'),
          ],
          executions: {
            [original.id]: dividendExecution({
              id: 'execution-original',
              commissions_currency: ILS_LABEL,
              trade_commission_value_nis: '25',
            }),
            [cancellation.id]: dividendExecution({
              id: 'execution-cancellation',
              net_value_trade_currency: '-1000',
              net_value_settlement_currency: '-1000',
              commissions_currency: ILS_LABEL,
              trade_commission_value_nis: '-25',
              is_cancel_transaction: 'כן',
            }),
            [replacement.id]: dividendExecution({
              id: 'execution-replacement',
              trade_gross_value_trade_currency: '992',
              net_value_trade_currency: '992',
              net_value_settlement_currency: '992',
              commissions_currency: ILS_LABEL,
              trade_commission_value_nis: '24.80',
            }),
          },
        });

        expect(errors).toEqual([]);
      });

      it('reports a fee that differs from the reported commission, and still books it', async () => {
        const transaction = buildTransaction({ id: 'transaction-dividend', amount: '1000' });

        const { records, errors } = await generate({
          transactions: [transaction, commissionFee('-20')],
          executions: { [transaction.id]: dividendWithCommission() },
        });

        expect(recordOf(records, FEES_TAX_CATEGORY_ID)).toBeDefined();
        expect(errors).toEqual([
          'Fee transactions for MOCK (US0000000001) charge 20.00 ILS, but the bank reported a commission of 25.00 ILS',
        ]);
      });
    });
  });

  describe('bond interest', () => {
    const interestExecution = (overrides: Partial<SecurityExecutionRow> = {}) =>
      buildExecution({
        id: 'execution-interest',
        trade_type: TRADE_TYPES.interest,
        payment_type: 'ריבית',
        isin: 'FR0000000001',
        issuer_country_code: 'FR',
        ...overrides,
      });

    it('credits foreign bond interest income when nothing was withheld, leaving the fee as is', async () => {
      const transaction = buildTransaction({ id: 'transaction-interest', amount: '1000' });

      const { records, errors } = await generate({
        transactions: [transaction, feeTransaction],
        executions: { [transaction.id]: interestExecution() },
      });

      expect(errors).toEqual([]);
      expect(summarize(recordOf(records, BANK_USD)!)).toEqual({
        ...baseCashInRecord(1000),
        credit1: TAX_CATEGORIES.FOREIGN_BOND_INTEREST_INCOME,
      });
      expect(recordOf(records, FEES_TAX_CATEGORY_ID)?.credit_entity1).toBe(BANK_ILS);
    });

    it('books withheld tax to foreign or local bond withholding tax by the issuer', async () => {
      const transaction = buildTransaction({ id: 'transaction-interest', amount: '1000' });
      const taxed = {
        trade_gross_value_trade_currency: '1100',
        capital_tax_value_settlement_currency: '100',
      };

      const foreign = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: interestExecution(taxed) },
      });
      const local = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: interestExecution({
            ...taxed,
            isin: 'IL0000000002',
            issuer_country_code: 'IL',
          }),
        },
      });

      for (const [{ records, errors }, incomeTaxCategoryId, withholdingTaxCategoryId] of [
        [
          foreign,
          TAX_CATEGORIES.FOREIGN_BOND_INTEREST_INCOME,
          TAX_CATEGORIES.FOREIGN_BOND_WITHHOLDING_TAX,
        ],
        [
          local,
          TAX_CATEGORIES.LOCAL_BOND_INTEREST_INCOME,
          TAX_CATEGORIES.LOCAL_BOND_WITHHOLDING_TAX,
        ],
      ] as const) {
        expect(errors).toEqual([]);
        expect(records.map(summarize)).toEqual([
          {
            ...baseCashInRecord(1000),
            debit2: withholdingTaxCategoryId,
            debitForeign2: usd(100).foreign,
            debitLocal2: usd(100).local,
            credit1: incomeTaxCategoryId,
            creditForeign1: usd(1100).foreign,
            creditLocal1: usd(1100).local,
          },
        ]);
      }
    });

    it('books the reported tax and reports it when gross minus net disagrees', async () => {
      const transaction = buildTransaction({ id: 'transaction-interest', amount: '1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: interestExecution({
            israel_tax_value_by_payments_settlement_currency: '20',
          }),
        },
      });

      expect(records.map(summarize)).toEqual([
        {
          ...baseCashInRecord(1000),
          debit2: TAX_CATEGORIES.FOREIGN_BOND_WITHHOLDING_TAX,
          debitForeign2: usd(20).foreign,
          debitLocal2: usd(20).local,
          credit1: TAX_CATEGORIES.FOREIGN_BOND_INTEREST_INCOME,
          creditForeign1: usd(1020).foreign,
          creditLocal1: usd(1020).local,
        },
      ]);
      expect(errors).toEqual([expect.stringContaining('does not match gross minus net')]);
    });

    it('books a refund of withheld tax as a second credit', async () => {
      // 950 declared, 50 of earlier withholding refunded, 1,000 received
      const transaction = buildTransaction({ id: 'transaction-interest', amount: '1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: interestExecution({
            trade_gross_value_trade_currency: '950',
            israel_tax_value_by_payments_settlement_currency: '-50',
          }),
        },
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([
        {
          ...baseCashInRecord(1000),
          credit1: TAX_CATEGORIES.FOREIGN_BOND_INTEREST_INCOME,
          creditForeign1: usd(950).foreign,
          creditLocal1: usd(950).local,
          credit2: TAX_CATEGORIES.FOREIGN_BOND_WITHHOLDING_TAX,
          creditForeign2: usd(50).foreign,
          creditLocal2: usd(50).local,
        },
      ]);
    });

    it('keeps the base entry and names a missing income category', async () => {
      const transaction = buildTransaction({ id: 'transaction-interest', amount: '1000' });
      const { FOREIGN_BOND_INTEREST_INCOME: _, ...taxCategories } = TAX_CATEGORIES;

      const { records, errors, missingSecuritiesTaxCategories } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: interestExecution() },
        taxCategories,
      });

      expect(records.map(summarize)).toEqual([baseCashInRecord(1000)]);
      expect(errors).toEqual([
        expect.stringContaining('Missing securities tax category "Foreign bond interest income"'),
      ]);
      expect(missingSecuritiesTaxCategories).toEqual(['FOREIGN_BOND_INTEREST_INCOME']);
    });

    it('names a missing withholding category only when tax was withheld', async () => {
      const transaction = buildTransaction({ id: 'transaction-interest', amount: '1000' });
      const { FOREIGN_BOND_WITHHOLDING_TAX: _, ...taxCategories } = TAX_CATEGORIES;

      const withoutTax = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: interestExecution() },
        taxCategories,
      });
      expect(withoutTax.errors).toEqual([]);
      expect(withoutTax.records[0].credit_entity1).toBe(
        TAX_CATEGORIES.FOREIGN_BOND_INTEREST_INCOME,
      );

      const withTax = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: interestExecution({
            trade_gross_value_trade_currency: '1100',
            foreign_tax_value_settlement_currency: '100',
          }),
        },
        taxCategories,
      });
      expect(withTax.records.map(summarize)).toEqual([baseCashInRecord(1000)]);
      expect(withTax.errors).toEqual([
        expect.stringContaining('Missing securities tax category "Foreign bond withholding tax"'),
      ]);
      expect(withTax.missingSecuritiesTaxCategories).toEqual(['FOREIGN_BOND_WITHHOLDING_TAX']);
    });

    it('books a cancelled interest payment as the mirror of its income entry', async () => {
      const transaction = buildTransaction({ id: 'transaction-cancellation', amount: '-1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: interestExecution({
            net_value_trade_currency: '-1000',
            net_value_settlement_currency: '-1000',
            is_cancel_transaction: 'כן',
          }),
        },
      });

      expect(errors).toEqual([
        expect.stringContaining('cancels an interest payment of MOCK (FR0000000001)'),
      ]);
      expect(records.map(summarize)).toEqual([
        {
          ...baseCashInRecord(1000),
          debit1: TAX_CATEGORIES.FOREIGN_BOND_INTEREST_INCOME,
          credit1: BANK_USD,
        },
      ]);
    });
  });

  describe('bond redemption', () => {
    it('keeps the base entry of a cancelled redemption and says its reversal is not booked', async () => {
      const transaction = buildTransaction({ id: 'transaction-cancellation', amount: '-1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: redemptionExecution(10, -1000, { is_cancel_transaction: 'כן' }),
        },
      });

      expect(records).toHaveLength(1);
      expect(summarize(records[0]!)).toMatchObject({ debit1: SECURITIES_USD, credit1: BANK_USD });
      expect(errors).toEqual([
        expect.stringContaining('reverses a cancelled redemption of MOCK (US0000000001)'),
      ]);
    });

    it('credits the FIFO purchase cost and books the gain', async () => {
      // lots: 10 for 1,000 and 10 for 1,200; 5 sold since, from the first lot.
      // The redemption of the remaining 15 costs 5 × 100 + 10 × 120 = 1,700 and pays 1,900.
      const transaction = buildTransaction({ id: 'transaction-redemption', amount: '1900' });
      const redemption = redemptionExecution(15, 1900);

      const { records, errors, foreignSecuritiesProvider } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: redemption },
        history: [
          buyExecution('execution-buy-1', '2023-01-10', 10, 1000),
          buyExecution('execution-buy-2', '2023-06-10', 10, 1200),
          buildExecution({
            id: 'execution-sell',
            trade_type: TRADE_TYPES.sell,
            transaction_type: TRADE_TYPES.sell,
            trade_date: '2024-01-10',
            value_date: '2024-01-10',
            nv: '5',
            net_value_trade_currency: '550',
            net_value_settlement_currency: '550',
          }),
          redemption,
        ],
      });

      expect(errors).toEqual([]);
      expect(foreignSecuritiesProvider.getSecurityAccountHistory).toHaveBeenCalledWith(
        redemption,
        OWNER_ID,
      );
      expect(records.map(summarize)).toEqual([
        {
          ...baseCashInRecord(1900),
          creditForeign1: usd(1700).foreign,
          creditLocal1: usd(1700).local,
          credit2: TAX_CATEGORIES.FOREIGN_SECURITIES_SALE_GAIN,
          creditForeign2: usd(200).foreign,
          creditLocal2: usd(200).local,
        },
      ]);
    });

    it('books a loss as a second debit', async () => {
      const transaction = buildTransaction({ id: 'transaction-redemption', amount: '1000' });
      const redemption = redemptionExecution(10, 1000);

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: redemption },
        history: [buyExecution('execution-buy', '2023-01-10', 10, 1200), redemption],
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([
        {
          ...baseCashInRecord(1000),
          debit2: TAX_CATEGORIES.FOREIGN_SECURITIES_SALE_LOSS,
          debitForeign2: usd(200).foreign,
          debitLocal2: usd(200).local,
          creditForeign1: usd(1200).foreign,
          creditLocal1: usd(1200).local,
        },
      ]);
    });

    it('books no secondary line at break-even', async () => {
      const transaction = buildTransaction({ id: 'transaction-redemption', amount: '1000' });
      const redemption = redemptionExecution(10, 1000);

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: redemption },
        history: [buyExecution('execution-buy', '2023-01-10', 10, 1000), redemption],
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([baseCashInRecord(1000)]);
    });

    it('books tax withheld on a redemption to foreign bond withholding tax, with the gain on gross', async () => {
      // 1,050 gross, 50 withheld, 1,000 received; cost 900, so the gain is 150
      const transaction = buildTransaction({ id: 'transaction-redemption', amount: '1000' });
      const redemption = redemptionExecution(10, 1000, {
        trade_gross_value_trade_currency: '1050',
        israel_tax_value_by_payments_settlement_currency: '50',
      });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: redemption },
        history: [buyExecution('execution-buy', '2023-01-10', 10, 900), redemption],
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([
        {
          ...baseCashInRecord(1000),
          debit2: TAX_CATEGORIES.FOREIGN_BOND_WITHHOLDING_TAX,
          debitForeign2: usd(50).foreign,
          debitLocal2: usd(50).local,
          creditForeign1: usd(900).foreign,
          creditLocal1: usd(900).local,
          credit2: TAX_CATEGORIES.FOREIGN_SECURITIES_SALE_GAIN,
          creditForeign2: usd(150).foreign,
          creditLocal2: usd(150).local,
        },
      ]);
    });

    it('books tax withheld on a redemption of a local bond to local bond withholding tax', async () => {
      const transaction = buildTransaction({ id: 'transaction-redemption', amount: '1000' });
      const redemption = redemptionExecution(10, 1000, {
        isin: 'IL0000000002',
        issuer_country_code: 'IL',
        trade_gross_value_trade_currency: '1050',
        israel_tax_value_by_payments_settlement_currency: '50',
      });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: redemption },
        history: [buyExecution('execution-buy', '2023-01-10', 10, 900), redemption],
      });

      expect(errors).toEqual([]);
      expect(records[0].debit_entity2).toBe(TAX_CATEGORIES.LOCAL_BOND_WITHHOLDING_TAX);
    });

    it('needs the locality of a redeemed bond only when tax was withheld', async () => {
      const transaction = buildTransaction({ id: 'transaction-redemption', amount: '1000' });
      const unknownLocality = { isin: null, issuer_country_code: null };

      const untaxed = redemptionExecution(10, 1000, unknownLocality);
      const withoutTax = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: untaxed },
        history: [buyExecution('execution-buy', '2023-01-10', 10, 1000), untaxed],
      });
      expect(withoutTax.errors).toEqual([]);
      expect(withoutTax.records.map(summarize)).toEqual([baseCashInRecord(1000)]);

      const taxed = redemptionExecution(10, 1000, {
        ...unknownLocality,
        trade_gross_value_trade_currency: '1050',
        israel_tax_value_by_payments_settlement_currency: '50',
      });
      const withTax = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: taxed },
        history: [buyExecution('execution-buy', '2023-01-10', 10, 900), taxed],
      });
      expect(withTax.records.map(summarize)).toEqual([baseCashInRecord(1000)]);
      expect(withTax.errors).toEqual([expect.stringContaining('is local or foreign')]);
    });

    it('keeps the base entry for a loss with withheld tax, which needs a third debit', async () => {
      const transaction = buildTransaction({ id: 'transaction-redemption', amount: '1000' });
      const redemption = redemptionExecution(10, 1000, {
        trade_gross_value_trade_currency: '1050',
        israel_tax_value_by_payments_settlement_currency: '50',
      });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: redemption },
        history: [buyExecution('execution-buy', '2023-01-10', 10, 1200), redemption],
      });

      expect(records.map(summarize)).toEqual([baseCashInRecord(1000)]);
      expect(errors).toEqual([expect.stringContaining('not supported')]);
    });

    it('keeps the base entry and explains a purchase missing from the scraped history', async () => {
      const transaction = buildTransaction({ id: 'transaction-redemption', amount: '1000' });
      const redemption = redemptionExecution(10, 1000, { nominal_profit_loss_nis: '350' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: redemption },
        history: [buyExecution('execution-buy', '2024-05-10', 4, 380), redemption],
      });

      expect(records.map(summarize)).toEqual([baseCashInRecord(1000)]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('purchase');
      expect(errors[0]).toContain('6 of 10');
      expect(errors[0]).toContain('2024-05-10');
      expect(errors[0]).toContain('MOCK');
      expect(errors[0]).toContain('350');
    });

    it('keeps the base entry when the history starts mid-position', async () => {
      // 5 units sold before any purchase was scraped: an older holding comes first in FIFO
      const transaction = buildTransaction({ id: 'transaction-redemption', amount: '1000' });
      const redemption = redemptionExecution(10, 1000);

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: redemption },
        history: [
          buildExecution({
            id: 'execution-sell',
            trade_type: TRADE_TYPES.sell,
            transaction_type: TRADE_TYPES.sell,
            trade_date: '2023-01-10',
            value_date: '2023-01-10',
            nv: '5',
            net_value_trade_currency: '500',
            net_value_settlement_currency: '500',
          }),
          buyExecution('execution-buy', '2023-06-10', 10, 900),
          redemption,
        ],
      });

      expect(records.map(summarize)).toEqual([baseCashInRecord(1000)]);
      expect(errors).toEqual([expect.stringContaining('starts mid-position')]);
    });

    it('keeps the base entry when the redeemed units came in with no known cost', async () => {
      const transaction = buildTransaction({ id: 'transaction-redemption', amount: '1000' });
      const redemption = redemptionExecution(10, 1000);

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: redemption },
        history: [
          buildExecution({
            id: 'execution-transfer-in',
            trade_type: 'העברה לזכות הפקדון',
            transaction_type: 'העברות',
            trade_date: '2023-01-10',
            nv: '10',
            net_value_trade_currency: '0',
            net_value_settlement_currency: '0',
          }),
          redemption,
        ],
      });

      expect(records.map(summarize)).toEqual([baseCashInRecord(1000)]);
      expect(errors).toEqual([expect.stringContaining('no known purchase cost')]);
    });

    it('keeps the base entry and names a missing gain category', async () => {
      const transaction = buildTransaction({ id: 'transaction-redemption', amount: '1100' });
      const redemption = redemptionExecution(10, 1100);
      const { FOREIGN_SECURITIES_SALE_GAIN: _, ...taxCategories } = TAX_CATEGORIES;

      const { records, errors, missingSecuritiesTaxCategories } = await generate({
        transactions: [transaction],
        executions: { [transaction.id]: redemption },
        history: [buyExecution('execution-buy', '2023-01-10', 10, 1000), redemption],
        taxCategories,
      });

      expect(records.map(summarize)).toEqual([baseCashInRecord(1100)]);
      expect(errors).toEqual([
        expect.stringContaining(
          'Missing securities tax category "Gain from sale of foreign securities"',
        ),
      ]);
      expect(missingSecuritiesTaxCategories).toEqual(['FOREIGN_SECURITIES_SALE_GAIN']);
    });
  });

  it('reports each missing tax category once across transactions', async () => {
    const first = buildTransaction({ id: 'transaction-dividend-1', amount: '1000' });
    const second = buildTransaction({ id: 'transaction-dividend-2', amount: '500' });
    const { FOREIGN_DIVIDEND_INCOME: _, ...taxCategories } = TAX_CATEGORIES;

    const { missingSecuritiesTaxCategories } = await generate({
      transactions: [first, second],
      executions: {
        [first.id]: buildExecution({ id: 'execution-1', trade_type: TRADE_TYPES.dividend }),
        [second.id]: buildExecution({
          id: 'execution-2',
          trade_type: TRADE_TYPES.dividend,
          trade_gross_value_trade_currency: '500',
          net_value_trade_currency: '500',
          net_value_settlement_currency: '500',
        }),
      },
      taxCategories,
    });

    expect(missingSecuritiesTaxCategories).toEqual(['FOREIGN_DIVIDEND_INCOME']);
  });

  it('names a missing fees category, so it can be set from the charge', async () => {
    const { FOREIGN_SECURITIES_FEES: _, ...taxCategories } = TAX_CATEGORIES;

    const { records, errors, missingSecuritiesTaxCategories } = await generate({
      transactions: [feeTransaction],
      taxCategories,
    });

    expect(records).toEqual([]);
    expect(errors).toEqual([
      expect.stringContaining('Missing securities tax category "Foreign securities fees"'),
    ]);
    expect(missingSecuritiesTaxCategories).toEqual(['FOREIGN_SECURITIES_FEES']);
  });

  it('generates the fee entries of a charge with no main transaction instead of failing', async () => {
    const { records, errors } = await generate({ transactions: [feeTransaction] });

    expect(errors).toEqual([]);
    expect(records.map(summarize)).toEqual([
      expect.objectContaining({
        currency: Currency.Ils,
        debit1: FEES_TAX_CATEGORY_ID,
        credit1: BANK_ILS,
        creditLocal1: 25,
      }),
    ]);
  });

  describe('stock distributions booked directly', () => {
    /** A dividend paid in shares: no cash leg, valued at units times price */
    const distributionExecution = (overrides: Partial<SecurityExecutionRow> = {}) =>
      buildExecution({
        id: 'execution-distribution',
        trade_type: 'הטבה חלוקת מניות',
        payment_type: 'דיבידנד בעין',
        nv: '10',
        trade_price: '100',
        trade_gross_value_trade_currency: '1000',
        // the net value columns of a distribution hold its commission, not the shares' value
        net_value_trade_currency: '0',
        net_value_settlement_currency: '-7',
        net_value_nis: '-25',
        trade_gross_value_nis: String(1000 * USD_RATE),
        personal_currency_rate: String(USD_RATE),
        ...overrides,
      });

    const distributionRecord = {
      currency: Currency.Usd,
      debit1: SECURITIES_USD,
      debitForeign1: usd(1000).foreign,
      debitLocal1: usd(1000).local,
      debit2: null,
      debitForeign2: null,
      debitLocal2: null,
      credit1: TAX_CATEGORIES.FOREIGN_DIVIDEND_INCOME,
      creditForeign1: usd(1000).foreign,
      creditLocal1: usd(1000).local,
      credit2: null,
      creditForeign2: null,
      creditLocal2: null,
    };

    beforeEach(() => {
      // a charge created for a distribution has no counterparty
      vi.mocked(getChargeBusinesses).mockResolvedValue({ mainBusinessId: null } as never);
    });

    it('debits the securities account and credits foreign dividend income at the gross value', async () => {
      const { records, errors, missingSecuritiesTaxCategories } = await generate({
        transactions: [],
        distributions: [distributionExecution()],
      });

      expect(errors).toEqual([]);
      expect(missingSecuritiesTaxCategories ?? []).toEqual([]);
      expect(records.map(summarize)).toEqual([distributionRecord]);
      expect(records[0]!.description).toBe('Stock distribution: 10 × MOCK');
    });

    it('credits local dividend income for an Israeli issuer', async () => {
      const { records, errors } = await generate({
        transactions: [],
        distributions: [
          distributionExecution({ issuer_country_code: 'IL', isin: 'IL0000000001' }),
        ],
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([
        { ...distributionRecord, credit1: TAX_CATEGORIES.LOCAL_DIVIDEND_INCOME },
      ]);
    });

    it('books at the ledger rate and reports a different bank rate', async () => {
      const { records, errors } = await generate({
        transactions: [],
        distributions: [distributionExecution({ personal_currency_rate: '3.6' })],
      });

      expect(records.map(summarize)).toEqual([distributionRecord]);
      expect(errors).toEqual([
        expect.stringMatching(/ledger rate of 3\.5 ILS per USD, but the bank priced it at 3\.6$/),
      ]);
    });

    it('falls back to the bank\'s local value when it reports no rate', async () => {
      const { errors } = await generate({
        transactions: [],
        distributions: [
          distributionExecution({ personal_currency_rate: '-1', trade_gross_value_nis: '3700' }),
        ],
      });

      expect(errors).toEqual([expect.stringContaining('but the bank priced it at 3.7')]);
    });

    it('does not book a distribution with withheld tax', async () => {
      const { records, errors } = await generate({
        transactions: [],
        distributions: [distributionExecution({ foreign_tax_value_settlement_currency: '150' })],
      });

      expect(records).toEqual([]);
      expect(errors).toEqual([
        expect.stringContaining('booking tax withheld on a stock distribution is not supported yet'),
      ]);
    });

    it('does not book a distribution other than a dividend in kind', async () => {
      const { records, errors } = await generate({
        transactions: [],
        distributions: [distributionExecution({ payment_type: null })],
      });

      expect(records).toEqual([]);
      expect(errors).toEqual([
        expect.stringContaining('only stock distributions paid as a dividend in kind are booked'),
      ]);
    });

    it('does not book a cancelled distribution', async () => {
      const { records, errors } = await generate({
        transactions: [],
        distributions: [distributionExecution({ is_cancel_transaction: 'כן' })],
      });

      expect(records).toEqual([]);
      expect(errors).toEqual([expect.stringContaining('cancellation of the stock distribution')]);
    });

    it('books a distribution the bank later cancelled, and says the reversal is not booked', async () => {
      const distribution = distributionExecution();
      const { records, errors } = await generate({
        transactions: [],
        distributions: [distribution],
        history: [
          distribution,
          distributionExecution({ id: 'execution-cancellation', is_cancel_transaction: 'כן' }),
        ],
      });

      expect(records.map(summarize)).toEqual([distributionRecord]);
      expect(errors).toEqual([
        expect.stringContaining('reports a cancellation of the stock distribution'),
      ]);
    });

    it('names a missing dividend income category', async () => {
      const { FOREIGN_DIVIDEND_INCOME: _, ...taxCategories } = TAX_CATEGORIES;

      const { records, missingSecuritiesTaxCategories } = await generate({
        transactions: [],
        distributions: [distributionExecution()],
        taxCategories,
      });

      expect(records).toEqual([]);
      expect(missingSecuritiesTaxCategories).toEqual(['FOREIGN_DIVIDEND_INCOME']);
    });

    it("debits the owner's own securities account, not one found by account number", async () => {
      const { records, errors } = await generate({
        transactions: [],
        distributions: [distributionExecution()],
        otherBusinessAccountByNumber: true,
      });

      expect(errors).toEqual([]);
      expect(records.map(summarize)).toEqual([distributionRecord]);
    });

    it('reads the account history once for several distributions of one security', async () => {
      const { records, foreignSecuritiesProvider } = await generate({
        transactions: [],
        distributions: [
          distributionExecution({ id: 'execution-distribution-1' }),
          distributionExecution({ id: 'execution-distribution-2' }),
        ],
      });

      expect(records).toHaveLength(2);
      expect(foreignSecuritiesProvider.getSecurityAccountHistory).toHaveBeenCalledTimes(1);
    });

    it('does not take a later cancellation of another same-size distribution as its own', async () => {
      const distribution = distributionExecution({ trade_date: '2024-03-12' });
      const later = distributionExecution({ id: 'execution-later' });
      const { records, errors } = await generate({
        transactions: [],
        distributions: [distribution],
        history: [
          distribution,
          later,
          distributionExecution({ id: 'execution-cancellation', is_cancel_transaction: 'כן' }),
        ],
      });

      expect(errors).toEqual([]);
      expect(records).toHaveLength(1);
    });

    describe('commission', () => {
      const commissionFee = {
        ...buildTransaction({
          id: 'transaction-commission',
          amount: '-25',
          currency: Currency.Ils,
          businessId: BANK_BUSINESS_ID,
          isFee: true,
          description: "ניעז עמ' תשלום FSEC PYMNT FEE",
        }),
        source_reference: '7654321',
      };
      const distributionWithCommission = () =>
        distributionExecution({
          commissions_currency: ILS_LABEL,
          trade_commission_value_nis: '25',
        });

      it('asks to merge in the fee charge when the charge has no fee for the commission', async () => {
        const { records, errors } = await generate({
          transactions: [],
          distributions: [distributionWithCommission()],
        });

        expect(records.map(summarize)).toEqual([distributionRecord]);
        expect(errors).toEqual([
          'A commission of 25.00 ILS was reported for MOCK (US0000000001), but the charge has no fee transaction for it — merge the charge holding the commission fee into this one',
        ]);
      });

      it('counts the commission once when a merged-in transaction is also matched to the distribution', async () => {
        const transaction = buildTransaction({ id: 'transaction-matched', amount: '0' });
        const distribution = distributionWithCommission();
        const { errors } = await generate({
          transactions: [transaction, commissionFee],
          executions: { [transaction.id]: distribution },
          distributions: [distribution],
        });

        expect(errors.filter(error => error.includes('commission'))).toEqual([]);
      });

      it('books the merged fee and accepts the commission', async () => {
        const { records, errors } = await generate({
          transactions: [commissionFee],
          distributions: [distributionWithCommission()],
        });

        expect(errors).toEqual([]);
        expect(records.map(summarize)).toEqual([
          distributionRecord,
          expect.objectContaining({ debit1: FEES_TAX_CATEGORY_ID, credit1: BANK_ILS, creditLocal1: 25 }),
        ]);
      });
    });
  });
});
