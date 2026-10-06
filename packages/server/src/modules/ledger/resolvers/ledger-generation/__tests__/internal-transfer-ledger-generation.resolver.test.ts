import { describe, expect, it } from 'vitest';
import type { Injector } from 'graphql-modules';
import { TEST_TIMEZONES, useTimezone } from '../../../../../__tests__/helpers/timezones.js';
import { Currency } from '../../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../../../charges/types.js';
import { ExchangeProvider } from '../../../../exchange-rates/providers/exchange.provider.js';
import { FinancialEntitiesProvider } from '../../../../financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../../../../financial-entities/providers/tax-categories.provider.js';
import { MiscExpensesProvider } from '../../../../misc-expenses/providers/misc-expenses.provider.js';
import type { IGetExpensesByChargeIdsResult } from '../../../../misc-expenses/types.js';
import { TransactionsProvider } from '../../../../transactions/providers/transactions.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../../transactions/types.js';
import { generateLedgerRecordsForInternalTransfer } from '../internal-transfer-ledger-generation.resolver.js';
import {
  at,
  buildTransaction as buildMockTransaction,
  EXCHANGE_LEDGER_RECORD,
  exchangeRecords,
  expectGeneratedRecords,
  makeExchangeProvider,
  makeFinancialEntitiesProvider,
  makeInjector as makeMockInjector,
  summarize,
  type MockRate,
  type TransactionInput,
} from './helpers/ledger-generation-mocks.js';

/*
 * Internal transfers between two of the owner's own accounts, e.g. moving a token from a
 * self-custody wallet to an exchange. Each leg is valued at its own exchange rate; when the two
 * rates differ, the difference is booked to the exchange-rate tax category.
 *
 * Crypto legs are priced at their exact `debit_timestamp`, so two legs on the same day at
 * different times can carry different rates. Ledger dates are days (#4560), but the check for
 * "were the entries valued at more than one rate point" must still tell those times apart.
 *
 * All IDs, amounts, rates and dates below are made up.
 */

const CHARGE_ID = 'charge-internal-transfer';
const OWNER_ID = 'owner-business';

const WALLET_ACCOUNT_ID = 'account-self-custody-wallet';
const EXCHANGE_ACCOUNT_ID = 'account-exchange';
/** The counterparty businesses of each leg: the owner's own accounts, as seen from the other side */
const WALLET_BUSINESS_ID = 'business-self-custody-wallet';
const EXCHANGE_BUSINESS_ID = 'business-exchange';

const CHARGE_TAX_CATEGORY_ID = 'tax-category-internal-transfers';
const EXCHANGE_RATES_TAX_CATEGORY_ID = 'tax-category-exchange-rates';
const FEES_TAX_CATEGORY_ID = 'tax-category-fees';
const GENERAL_FEES_TAX_CATEGORY_ID = 'tax-category-general-fees';
const SHAREHOLDER_ACCOUNT_ID = 'tax-category-shareholder-current-account';

const DAY: TimelessDateString = '2025-03-12';
const NEXT_DAY: TimelessDateString = '2025-03-13';

/** The tax category the ledger books a financial account's movements in a currency to */
function accountTaxCategoryId(accountId: string, currency: Currency): string {
  return `tax-category:${accountId}:${currency}`;
}

function buildTransaction(
  input: Omit<TransactionInput, 'chargeId' | 'ownerId'>,
): IGetTransactionsByChargeIdsResult {
  return buildMockTransaction({ ...input, chargeId: CHARGE_ID, ownerId: OWNER_ID });
}

function buildMiscExpense(
  overrides: Partial<IGetExpensesByChargeIdsResult> &
    Pick<IGetExpensesByChargeIdsResult, 'amount' | 'currency' | 'value_date'>,
): IGetExpensesByChargeIdsResult {
  return {
    id: 'misc-expense-fee-paid-by-shareholder',
    charge_id: CHARGE_ID,
    creditor_id: SHAREHOLDER_ACCOUNT_ID,
    debtor_id: accountTaxCategoryId(WALLET_ACCOUNT_ID, Currency.Eth),
    description: 'Fee paid by a shareholder',
    invoice_date: DAY,
    owner_id: OWNER_ID,
    ...overrides,
  };
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
  tax_category_id: CHARGE_TAX_CATEGORY_ID,
  type: 'INTERNAL',
  updated_at: new Date('2025-03-14T00:00:00.000Z'),
  user_description: null,
};

function makeInjector(options: {
  transactions: IGetTransactionsByChargeIdsResult[];
  miscExpenses?: IGetExpensesByChargeIdsResult[];
  rates: MockRate[];
}) {
  const exchangeProvider = makeExchangeProvider(options.rates);

  const injector = makeMockInjector(
    new Map<unknown, unknown>([
      [
        AdminContextProvider,
        {
          getVerifiedAdminContext: async () => ({
            defaultLocalCurrency: Currency.Ils,
            general: {
              taxCategories: {
                exchangeRateTaxCategoryId: EXCHANGE_RATES_TAX_CATEGORY_ID,
                feeTaxCategoryId: FEES_TAX_CATEGORY_ID,
                generalFeeTaxCategoryId: GENERAL_FEES_TAX_CATEGORY_ID,
              },
            },
            financialAccounts: {
              // both counterparties are the owner's own accounts, so fees are supplemental
              internalWalletsIds: [WALLET_BUSINESS_ID, EXCHANGE_BUSINESS_ID],
              swiftBusinessId: null,
            },
          }),
        },
      ],
      [
        TransactionsProvider,
        { transactionsByChargeIDLoader: { load: async () => options.transactions } },
      ],
      [ExchangeProvider, exchangeProvider],
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
      // every entity in these ledgers is a tax category, so no business may stay unbalanced
      [FinancialEntitiesProvider, makeFinancialEntitiesProvider()],
      [ChargesProvider, { getChargeByIdLoader: { load: async () => charge } }],
    ]),
  );

  return { injector, exchangeProvider };
}

async function generate(injector: Injector) {
  return expectGeneratedRecords(
    await generateLedgerRecordsForInternalTransfer(
      charge as never,
      { insertLedgerRecordsIfNotExists: false },
      { injector } as never,
      {} as never,
    ),
  );
}

describe.each(TEST_TIMEZONES)('generateLedgerRecordsForInternalTransfer (TZ=%s)', timeZone => {
  useTimezone(timeZone);

  describe('crypto transfer between own accounts', () => {
    /**
     * 25,000 GRT leave the wallet at 10:15 and reach the exchange at 10:42:30 the same day. The
     * token is worth ₪0.80 when it leaves and ₪0.81 when it arrives, so the legs are valued at
     * ₪20,000 and ₪20,250.
     */
    function transferLegs(options: {
      withdrawalTime: Date;
      depositTime: Date;
      withdrawalDay?: TimelessDateString;
      depositDay?: TimelessDateString;
    }) {
      return [
        buildTransaction({
          id: 'withdrawal',
          accountId: WALLET_ACCOUNT_ID,
          businessId: EXCHANGE_BUSINESS_ID,
          amount: '-25000',
          currency: Currency.Grt,
          debitDate: options.withdrawalDay ?? DAY,
          debitTimestamp: options.withdrawalTime,
        }),
        buildTransaction({
          id: 'deposit',
          accountId: EXCHANGE_ACCOUNT_ID,
          businessId: WALLET_BUSINESS_ID,
          amount: '25000',
          currency: Currency.Grt,
          debitDate: options.depositDay ?? DAY,
          debitTimestamp: options.depositTime,
          description: 'deposit',
        }),
      ];
    }

    it('books the rate difference between same-day legs to exchange rates, with a fee paid by a shareholder', async () => {
      const withdrawalTime = at(DAY, 10, 15);
      const depositTime = at(DAY, 10, 42, 30);

      // the network fee leaves the wallet with the transfer, and a shareholder paid it
      const fee = buildTransaction({
        id: 'network-fee',
        accountId: WALLET_ACCOUNT_ID,
        businessId: WALLET_BUSINESS_ID,
        amount: '-0.002',
        currency: Currency.Eth,
        debitDate: DAY,
        debitTimestamp: withdrawalTime,
        isFee: true,
        description: 'Network fee',
      });
      const feePaidByShareholder = buildMiscExpense({
        amount: '0.002',
        currency: Currency.Eth,
        value_date: withdrawalTime,
      });

      const { injector, exchangeProvider } = makeInjector({
        transactions: [...transferLegs({ withdrawalTime, depositTime }), fee],
        miscExpenses: [feePaidByShareholder],
        rates: [
          [Currency.Grt, withdrawalTime, 0.8],
          [Currency.Grt, depositTime, 0.81],
          [Currency.Eth, withdrawalTime, 10_000],
        ],
      });

      const { records, balance, errors } = await generate(injector);

      expect(errors).toEqual([]);
      expect(balance?.isBalanced).toBe(true);
      expect(records).toHaveLength(5);
      expect(records.map(summarize)).toEqual(
        expect.arrayContaining([
          {
            debit: null,
            credit: accountTaxCategoryId(WALLET_ACCOUNT_ID, Currency.Grt),
            currency: Currency.Grt,
            foreignAmount: 25_000,
            localAmount: 20_000,
            invoiceDate: DAY,
            valueDate: DAY,
            description: null,
          },
          {
            debit: accountTaxCategoryId(EXCHANGE_ACCOUNT_ID, Currency.Grt),
            credit: null,
            currency: Currency.Grt,
            foreignAmount: 25_000,
            localAmount: 20_250,
            invoiceDate: DAY,
            valueDate: DAY,
            description: 'deposit',
          },
          {
            debit: FEES_TAX_CATEGORY_ID,
            credit: accountTaxCategoryId(WALLET_ACCOUNT_ID, Currency.Eth),
            currency: Currency.Eth,
            foreignAmount: 0.002,
            localAmount: 20,
            invoiceDate: DAY,
            valueDate: DAY,
            description: 'Network fee',
          },
          {
            debit: accountTaxCategoryId(WALLET_ACCOUNT_ID, Currency.Eth),
            credit: SHAREHOLDER_ACCOUNT_ID,
            currency: Currency.Eth,
            foreignAmount: 0.002,
            localAmount: 20,
            invoiceDate: DAY,
            valueDate: DAY,
            description: 'Fee paid by a shareholder',
          },
          {
            // the deposit is worth more than the withdrawal: an exchange-rate gain
            debit: null,
            credit: EXCHANGE_RATES_TAX_CATEGORY_ID,
            currency: Currency.Ils,
            foreignAmount: null,
            localAmount: 250,
            invoiceDate: DAY,
            valueDate: DAY,
            description: EXCHANGE_LEDGER_RECORD,
          },
        ]),
      );

      // every crypto amount is priced at the exact time it moved, not at the day
      expect(exchangeProvider.getExchangeRates).toHaveBeenCalledWith(
        Currency.Grt,
        Currency.Ils,
        withdrawalTime,
      );
      expect(exchangeProvider.getExchangeRates).toHaveBeenCalledWith(
        Currency.Grt,
        Currency.Ils,
        depositTime,
      );
      expect(exchangeProvider.getExchangeRates).toHaveBeenCalledWith(
        Currency.Eth,
        Currency.Ils,
        withdrawalTime,
      );
    });

    it('books the rate difference from the two legs alone, without a fee or misc expense', async () => {
      const withdrawalTime = at(DAY, 10, 15);
      const depositTime = at(DAY, 10, 42, 30);
      const { injector } = makeInjector({
        transactions: transferLegs({ withdrawalTime, depositTime }),
        rates: [
          [Currency.Grt, withdrawalTime, 0.8],
          [Currency.Grt, depositTime, 0.81],
        ],
      });

      const { records, balance, errors } = await generate(injector);

      expect(errors).toEqual([]);
      expect(balance?.isBalanced).toBe(true);
      expect(records).toHaveLength(3);
      expect(exchangeRecords(records).map(summarize)).toEqual([
        expect.objectContaining({
          debit: null,
          credit: EXCHANGE_RATES_TAX_CATEGORY_ID,
          localAmount: 250,
          valueDate: DAY,
        }),
      ]);
    });

    it('debits exchange rates when the deposit is worth less than the withdrawal', async () => {
      const withdrawalTime = at(DAY, 10, 15);
      const depositTime = at(DAY, 10, 42, 30);
      const { injector } = makeInjector({
        transactions: transferLegs({ withdrawalTime, depositTime }),
        rates: [
          [Currency.Grt, withdrawalTime, 0.8],
          [Currency.Grt, depositTime, 0.79],
        ],
      });

      const { records, balance, errors } = await generate(injector);

      expect(errors).toEqual([]);
      expect(balance?.isBalanced).toBe(true);
      expect(exchangeRecords(records).map(summarize)).toEqual([
        expect.objectContaining({
          debit: EXCHANGE_RATES_TAX_CATEGORY_ID,
          credit: null,
          localAmount: 250,
          valueDate: DAY,
        }),
      ]);
    });

    it('needs no exchange record when both legs are priced at the same instant', async () => {
      const transferTime = at(DAY, 10, 15);
      const { injector } = makeInjector({
        transactions: transferLegs({ withdrawalTime: transferTime, depositTime: transferTime }),
        rates: [[Currency.Grt, transferTime, 0.8]],
      });

      const { records, balance, errors } = await generate(injector);

      expect(errors).toEqual([]);
      expect(balance?.isBalanced).toBe(true);
      expect(records).toHaveLength(2);
      expect(exchangeRecords(records)).toEqual([]);
    });

    it('keeps each leg on its own day across midnight, and dates the exchange record by the later one', async () => {
      const withdrawalTime = at(DAY, 23, 55);
      const depositTime = at(NEXT_DAY, 0, 5);
      const { injector } = makeInjector({
        transactions: transferLegs({
          withdrawalTime,
          depositTime,
          withdrawalDay: DAY,
          depositDay: NEXT_DAY,
        }),
        rates: [
          [Currency.Grt, withdrawalTime, 0.8],
          [Currency.Grt, depositTime, 0.81],
        ],
      });

      const { records, balance, errors } = await generate(injector);

      expect(errors).toEqual([]);
      expect(balance?.isBalanced).toBe(true);
      expect(records.map(summarize)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            credit: accountTaxCategoryId(WALLET_ACCOUNT_ID, Currency.Grt),
            valueDate: DAY,
          }),
          expect.objectContaining({
            debit: accountTaxCategoryId(EXCHANGE_ACCOUNT_ID, Currency.Grt),
            valueDate: NEXT_DAY,
          }),
        ]),
      );
      expect(exchangeRecords(records).map(summarize)).toEqual([
        expect.objectContaining({
          credit: EXCHANGE_RATES_TAX_CATEGORY_ID,
          localAmount: 250,
          invoiceDate: NEXT_DAY,
          valueDate: NEXT_DAY,
        }),
      ]);
    });
  });

  describe('fiat transfer between own accounts', () => {
    // fiat rows have no `debit_timestamp`: they are valued by their day
    function fiatLegs(options: {
      currency: Currency;
      withdrawalAmount: string;
      depositAmount: string;
      withdrawalDay?: TimelessDateString;
      depositDay?: TimelessDateString;
    }) {
      return [
        buildTransaction({
          id: 'withdrawal',
          accountId: 'account-bank',
          businessId: 'business-bank',
          amount: options.withdrawalAmount,
          currency: options.currency,
          debitDate: options.withdrawalDay ?? DAY,
        }),
        buildTransaction({
          id: 'deposit',
          accountId: 'account-broker',
          businessId: 'business-broker',
          amount: options.depositAmount,
          currency: options.currency,
          debitDate: options.depositDay ?? DAY,
        }),
      ];
    }

    it('is balanced without an exchange record when both legs are on the same day', async () => {
      const { injector, exchangeProvider } = makeInjector({
        transactions: fiatLegs({
          currency: Currency.Usd,
          withdrawalAmount: '-1000',
          depositAmount: '1000',
        }),
        rates: [[Currency.Usd, DAY, 3.6]],
      });

      const { records, balance, errors } = await generate(injector);

      expect(errors).toEqual([]);
      expect(balance?.isBalanced).toBe(true);
      expect(records).toHaveLength(2);
      expect(exchangeRecords(records)).toEqual([]);
      expect(exchangeProvider.getExchangeRates).toHaveBeenCalledWith(
        Currency.Usd,
        Currency.Ils,
        DAY,
      );
    });

    it('reports a same-day mismatch instead of booking it as an exchange-rate difference', async () => {
      const { injector } = makeInjector({
        transactions: fiatLegs({
          currency: Currency.Usd,
          withdrawalAmount: '-1000',
          depositAmount: '990',
        }),
        rates: [[Currency.Usd, DAY, 3.6]],
      });

      const { records, balance, errors } = await generate(injector);

      expect(exchangeRecords(records)).toEqual([]);
      expect(balance?.isBalanced).toBe(false);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/^Total ledger balance is /);
      expect(Number(errors[0].replace('Total ledger balance is ', ''))).toBeCloseTo(36, 6);
    });

    it('books the rate difference between legs on different days, dated by the later one', async () => {
      const { injector } = makeInjector({
        transactions: fiatLegs({
          currency: Currency.Usd,
          withdrawalAmount: '-1000',
          depositAmount: '1000',
          withdrawalDay: DAY,
          depositDay: NEXT_DAY,
        }),
        rates: [
          [Currency.Usd, DAY, 3.6],
          [Currency.Usd, NEXT_DAY, 3.62],
        ],
      });

      const { records, balance, errors } = await generate(injector);

      expect(errors).toEqual([]);
      expect(balance?.isBalanced).toBe(true);
      expect(exchangeRecords(records).map(summarize)).toEqual([
        expect.objectContaining({
          credit: EXCHANGE_RATES_TAX_CATEGORY_ID,
          currency: Currency.Ils,
          localAmount: 20,
          invoiceDate: NEXT_DAY,
          valueDate: NEXT_DAY,
        }),
      ]);
    });

    it('never books an exchange record for local-currency legs, even on different days', async () => {
      const { injector, exchangeProvider } = makeInjector({
        transactions: fiatLegs({
          currency: Currency.Ils,
          withdrawalAmount: '-1000',
          depositAmount: '990',
          withdrawalDay: DAY,
          depositDay: NEXT_DAY,
        }),
        rates: [],
      });

      const { records, balance, errors } = await generate(injector);

      expect(exchangeRecords(records)).toEqual([]);
      expect(balance?.isBalanced).toBe(false);
      expect(errors).toEqual(['Total ledger balance is 10']);
      expect(exchangeProvider.getExchangeRates).not.toHaveBeenCalled();
    });
  });
});
