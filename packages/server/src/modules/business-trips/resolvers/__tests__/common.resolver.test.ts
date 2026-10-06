import { describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { TEST_TIMEZONES, useTimezone } from '../../../../__tests__/helpers/timezones.js';
import { Currency } from '../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import type { IGetTransactionsByIdsResult } from '../../../transactions/types.js';
import { BusinessTripExpensesTransactionsMatchProvider } from '../../providers/business-trips-expenses-transactions-match.provider.js';
import { commonBusinessTripExpenseFields } from '../common.js';

/*
 * A business-trip expense matched to transactions is priced like the ledger prices those
 * transactions: a crypto row at its exact `debit_timestamp`, a fiat row by its day. All values
 * below are made up.
 */

const DAY: TimelessDateString = '2025-03-12';

function transaction(
  overrides: Partial<IGetTransactionsByIdsResult> &
    Pick<IGetTransactionsByIdsResult, 'amount' | 'currency'>,
): IGetTransactionsByIdsResult {
  return {
    id: 'transaction',
    account_id: 'account',
    business_id: 'business-hotel',
    charge_id: 'charge',
    counter_account: null,
    created_at: new Date('2025-03-14T00:00:00.000Z'),
    currency_rate: '0',
    current_balance: '0',
    debit_date: DAY,
    debit_date_override: null,
    debit_timestamp: null,
    event_date: DAY,
    is_fee: false,
    origin_key: 'origin',
    owner_id: 'owner',
    source_description: null,
    source_id: 'source',
    source_origin: 'MOCK',
    source_reference: 'reference',
    updated_at: new Date('2025-03-14T00:00:00.000Z'),
    ...overrides,
  };
}

/** Quotes a USD rate only for the exact day or instant given, failing on any other lookup */
function makeInjector(tx: IGetTransactionsByIdsResult, rateAt: TimelessDateString | Date) {
  const getExchangeRates = vi.fn(
    async (_base: Currency, _quote: Currency, date: TimelessDateString | Date) => {
      const key = (value: TimelessDateString | Date) =>
        typeof value === 'string' ? value : value.toISOString();
      if (key(date) !== key(rateAt)) {
        throw new Error(`No mock rate for ${key(date)}`);
      }
      return 2000;
    },
  );
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: async () => ({
          defaultCryptoConversionFiatCurrency: Currency.Usd,
        }),
      },
    ],
    [
      BusinessTripExpensesTransactionsMatchProvider,
      {
        getBusinessTripsExpenseMatchesByExpenseIdLoader: {
          load: async () => [{ transaction_id: tx.id, amount: null }],
        },
      },
    ],
    [TransactionsProvider, { transactionByIdLoader: { loadMany: async () => [tx] } }],
    [ExchangeProvider, { getExchangeRates }],
  ]);
  const injector = {
    get: (token: unknown) => {
      if (!providers.has(token)) {
        throw new Error(`Unexpected provider token: ${String(token)}`);
      }
      return providers.get(token);
    },
  } as unknown as Injector;
  return { injector, getExchangeRates };
}

async function amountOf(tx: IGetTransactionsByIdsResult, injector: Injector) {
  const resolveAmount = commonBusinessTripExpenseFields.amount as (
    ...args: unknown[]
  ) => Promise<{ raw: number } | null>;
  return resolveAmount(
    {
      id: 'expense',
      amount: tx.amount,
      currency: tx.currency,
      payed_by_employee: false,
      transaction_ids: [tx.id],
    },
    {},
    { injector },
    {},
  );
}

describe.each(TEST_TIMEZONES)('BusinessTripExpense.amount (TZ=%s)', timeZone => {
  useTimezone(timeZone);

  it('prices a matched crypto transaction at its exact debit time', async () => {
    const debitTime = new Date(2025, 2, 12, 23, 50);
    const tx = transaction({ amount: '-0.5', currency: Currency.Eth, debit_timestamp: debitTime });
    const { injector, getExchangeRates } = makeInjector(tx, debitTime);

    const amount = await amountOf(tx, injector);

    expect(getExchangeRates).toHaveBeenCalledWith(Currency.Eth, Currency.Usd, debitTime);
    expect(amount?.raw).toBe(-1000);
  });

  it('prices a matched fiat transaction by its day', async () => {
    const tx = transaction({ amount: '-50', currency: Currency.Eur });
    const { injector, getExchangeRates } = makeInjector(tx, DAY);

    const amount = await amountOf(tx, injector);

    expect(getExchangeRates).toHaveBeenCalledWith(Currency.Eur, Currency.Usd, DAY);
    expect(amount?.raw).toBe(-100_000);
  });
});
