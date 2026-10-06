import { describe, expect, it } from 'vitest';
import { TEST_TIMEZONES, useTimezone } from '../../../../__tests__/helpers/timezones.js';
import { Currency } from '../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import type { IGetChargesByIdsResult } from '../../../charges/types.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import { MiscExpensesProvider } from '../../../misc-expenses/providers/misc-expenses.provider.js';
import type { IGetExpensesByChargeIdsResult } from '../../../misc-expenses/types.js';
import {
  at,
  makeExchangeProvider,
  makeInjector,
} from '../../resolvers/ledger-generation/__tests__/helpers/ledger-generation-mocks.js';
import { generateMiscExpensesLedger } from '../misc-expenses-ledger.helper.js';

/*
 * `misc_expenses.value_date` is a `timestamp`. Its ledger entry is dated by the day, and a crypto
 * expense is priced at the time itself. All IDs, amounts and dates below are made up.
 */

const DAY: TimelessDateString = '2025-03-12';

describe.each(TEST_TIMEZONES)('generateMiscExpensesLedger (TZ=%s)', timeZone => {
  useTimezone(timeZone);

  it('dates the entry by the day of its value date, and prices it at the value date itself', async () => {
    const valueTime = at(DAY, 23, 50);
    const expense: IGetExpensesByChargeIdsResult = {
      id: 'misc-expense',
      charge_id: 'charge',
      amount: '0.002',
      currency: Currency.Eth,
      creditor_id: 'tax-category-shareholder-current-account',
      debtor_id: 'tax-category-wallet-eth',
      description: 'Fee paid by a shareholder',
      invoice_date: DAY,
      value_date: valueTime,
      owner_id: 'owner',
    };
    const exchangeProvider = makeExchangeProvider([[Currency.Eth, valueTime, 10_000]]);
    const injector = makeInjector(
      new Map<unknown, unknown>([
        [
          AdminContextProvider,
          { getVerifiedAdminContext: async () => ({ defaultLocalCurrency: Currency.Ils }) },
        ],
        [MiscExpensesProvider, { getExpensesByChargeIdLoader: { load: async () => [expense] } }],
        [ExchangeProvider, exchangeProvider],
      ]),
    );

    const [entry] = await generateMiscExpensesLedger(
      { id: 'charge' } as IGetChargesByIdsResult,
      injector,
    );

    expect(entry).toMatchObject({
      creditAccountID1: 'tax-category-shareholder-current-account',
      debitAccountID1: 'tax-category-wallet-eth',
      currency: Currency.Eth,
      localCurrencyCreditAmount1: 20,
      invoiceDate: DAY,
      valueDate: DAY,
      exchangeRateDate: valueTime,
    });
    expect(exchangeProvider.getExchangeRates).toHaveBeenCalledWith(
      Currency.Eth,
      Currency.Ils,
      valueTime,
    );
  });
});
