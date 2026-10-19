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
const RATES: MockRate[] = [[Currency.Usd, DAY, USD_RATE]];

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
};

function makeInjector(scenario: Scenario) {
  const foreignSecuritiesProvider = {
    getChargeExecutionsByTransactionId: vi.fn(
      async () => new Map(Object.entries(scenario.executions ?? {})),
    ),
    getSecurityAccountHistory: vi.fn(async () => scenario.history ?? []),
  };

  const injector = makeMockInjector(
    new Map<unknown, unknown>([
      [
        AdminContextProvider,
        {
          getVerifiedAdminContext: async () => ({
            ownerId: OWNER_ID,
            defaultLocalCurrency: Currency.Ils,
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
              accountNumber === 'foreign_securities' ? { id: SECURITIES_ACCOUNT_ID } : null,
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
      [FinancialEntitiesProvider, makeFinancialEntitiesProvider([BANK_BUSINESS_ID])],
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

    it('keeps the base entry of a cancelled dividend and says its reversal is not booked', async () => {
      const transaction = buildTransaction({ id: 'transaction-cancellation', amount: '-1000' });

      const { records, errors } = await generate({
        transactions: [transaction],
        executions: {
          [transaction.id]: dividendExecution({
            net_value_trade_currency: '-1000',
            net_value_settlement_currency: '-1000',
            is_cancel_transaction: 'כן',
          }),
        },
      });

      expect(records).toHaveLength(1);
      expect(summarize(records[0]!)).toMatchObject({ debit1: SECURITIES_USD, credit1: BANK_USD });
      expect(errors).toEqual([
        expect.stringContaining('reverses a cancelled dividend of MOCK (US0000000001)'),
      ]);
    });

    describe('commission', () => {
      /** The commission fee, which the bank keys to the security in its reference */
      const commissionFee = (amount: string) => ({
        ...buildTransaction({
          id: 'transaction-commission',
          amount,
          currency: Currency.Ils,
          businessId: BANK_BUSINESS_ID,
          isFee: true,
          description: "ניעז עמ' תשלום FSEC PYMNT FEE",
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
  });

  describe('bond redemption', () => {
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
});
