import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { Currency } from '../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import {
  CPI_INDEX_CODE,
  linkAmount,
  PriceIndexNotAvailableError,
  type PriceIndexPoint,
  type PriceIndexSeries,
} from '../../../price-indexes/helpers/price-index.helper.js';
import { PriceIndexesProvider } from '../../../price-indexes/providers/price-indexes.provider.js';
import { ForeignSecuritiesProvider } from '../../providers/foreign-securities.provider.js';
import { foreignSecuritiesResolvers } from '../../resolvers/foreign-securities.resolver.js';
import type { SecurityExecutionRow } from '../../types.js';
import {
  getSecurityCapitalGain,
  SecurityCapitalGainError,
} from '../security-capital-gain.helper.js';

/*
 * A sale's capital gain from its FIFO lots: price vs. exchange rate, and real vs. inflationary
 * under s.88 with the CPI as the index. All values are made up.
 */

const OWNER_ID = 'owner-business';
const USD_LABEL = 'דולר ארה"ב';

const LOT_DAY: TimelessDateString = '2025-01-20';
const SALE_DAY: TimelessDateString = '2025-03-12';

/** A CPI series published on the 15th of the next month: Dec 100, Jan 100.5, Feb 103 */
function cpiSeries(): PriceIndexSeries {
  const row = (period: string, chainedValue: number, publishedOn: string) => ({
    indexCode: CPI_INDEX_CODE,
    period: period as TimelessDateString,
    value: chainedValue,
    baseLabel: 'Average 2024',
    chainedValue,
    monthlyChangePct: null,
    yearlyChangePct: null,
    publishedOn: publishedOn as TimelessDateString,
  });
  return {
    indexCode: CPI_INDEX_CODE,
    bases: [
      {
        baseLabel: 'Average 2024',
        firstPeriod: '2024-01-01' as TimelessDateString,
        chainCoefficient: null,
        chainedFactor: 1,
      },
    ],
    rows: [
      row('2024-12-01', 100, '2025-01-15'),
      row('2025-01-01', 100.5, '2025-02-15'),
      row('2025-02-01', 103, '2025-03-15'),
    ],
  };
}

function execution(
  overrides: Partial<SecurityExecutionRow> & Pick<SecurityExecutionRow, 'id' | 'trade_type'>,
): SecurityExecutionRow {
  return {
    owner_id: OWNER_ID,
    security: '7654321',
    symbol: 'MOCK',
    isin: 'US0000000001',
    trade_currency: USD_LABEL,
    settlement_currency: USD_LABEL,
    net_value_nis: '0',
    payment_type: null,
    is_cancel_transaction: 'לא',
    ...overrides,
  } as SecurityExecutionRow;
}

// 10 units bought for 1,000 at 3.50, sold for 1,100 at 3.60
const buy = execution({
  id: 'execution-buy',
  trade_type: 'קניה',
  trade_date: LOT_DAY,
  value_date: LOT_DAY,
  nv: '10',
  trade_gross_value_trade_currency: '1000',
  net_value_trade_currency: '-1000',
  net_value_settlement_currency: '-1000',
});
const sale = execution({
  id: 'execution-sale',
  trade_type: 'מכירה',
  trade_date: SALE_DAY,
  value_date: SALE_DAY,
  nv: '10',
  trade_gross_value_trade_currency: '1100',
  net_value_trade_currency: '1100',
  net_value_settlement_currency: '1100',
});

function makeInjector(params: { history: SecurityExecutionRow[]; series?: PriceIndexSeries }) {
  const rates: Record<string, number> = { [LOT_DAY]: 3.5, [SALE_DAY]: 3.6 };
  const series = params.series ?? cpiSeries();
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      { getVerifiedAdminContext: async () => ({ defaultLocalCurrency: Currency.Ils }) },
    ],
    [ForeignSecuritiesProvider, { getSecurityOwnerHistory: vi.fn(async () => params.history) }],
    [
      ExchangeProvider,
      {
        getExchangeRates: async (_from: Currency, _to: Currency, date: TimelessDateString) => {
          const rate = rates[date];
          if (rate == null) {
            throw new Error(`No mock rate for ${date}`);
          }
          return rate;
        },
      },
    ],
    [
      PriceIndexesProvider,
      {
        linkAmount: async (amount: number, from: PriceIndexPoint, to: PriceIndexPoint) =>
          linkAmount(series, amount, from, to),
      },
    ],
  ]);
  return { get: (token: unknown) => providers.get(token) } as unknown as Injector;
}

describe('getSecurityCapitalGain', () => {
  it('splits the gain by price and rate, and by the CPI known on the trade dates', async () => {
    const gain = await getSecurityCapitalGain(makeInjector({ history: [buy, sale] }), sale);

    expect(gain).not.toBeNull();
    expect(gain!.quantity).toBe(10);
    expect(gain!.originCurrencyGain).toBeCloseTo(100, 6);
    // 1,100 × 3.60 − 1,000 × 3.50
    expect(gain!.nominalGain).toBeCloseTo(460, 6);
    expect(gain!.priceGain).toBeCloseTo(360, 6);
    expect(gain!.exchangeRateGain).toBeCloseTo(100, 6);
    // known on 20 Jan: Dec (100); known on 12 Mar: Jan (100.5) — Feb is only published on the 15th
    expect(gain!.lots).toEqual([
      expect.objectContaining({
        purchaseExecutionId: 'execution-buy',
        purchaseDate: LOT_DAY,
        costLocal: 3500,
        purchaseRate: 3.5,
        purchaseIndexPeriod: '2024-12',
        saleIndexPeriod: '2025-01',
      }),
    ]);
    expect(gain!.lots[0]!.indexRatio).toBeCloseTo(1.005, 9);
    // 3,500 × 0.5% of the gain is exempt
    expect(gain!.inflationaryAmount).toBeCloseTo(17.5, 6);
    expect(gain!.realGain).toBeCloseTo(442.5, 6);
  });

  it('is null for an execution that is not a disposal', async () => {
    expect(await getSecurityCapitalGain(makeInjector({ history: [buy] }), buy)).toBeNull();
  });

  it('is null for a cancelled sale', async () => {
    const cancelled = { ...sale, is_cancel_transaction: 'כן' };
    expect(await getSecurityCapitalGain(makeInjector({ history: [buy] }), cancelled)).toBeNull();
  });

  it('says why when the purchase cost is not known', async () => {
    await expect(getSecurityCapitalGain(makeInjector({ history: [sale] }), sale)).rejects.toThrow(
      SecurityCapitalGainError,
    );
  });

  it('fails on a CPI that is not available', async () => {
    const series = { ...cpiSeries(), rows: [] };
    await expect(
      getSecurityCapitalGain(makeInjector({ history: [buy, sale], series }), sale),
    ).rejects.toThrow(PriceIndexNotAvailableError);
  });
});

describe('SecurityExecution.capitalGain', () => {
  const resolve = (injector: Injector, row: SecurityExecutionRow) => {
    const resolver = foreignSecuritiesResolvers.SecurityExecution!.capitalGain as (
      ...args: unknown[]
    ) => Promise<unknown>;
    return resolver(row, {}, { injector }, {});
  };

  it('answers what the user can act on as an error', async () => {
    const series = { ...cpiSeries(), rows: [] };
    expect(await resolve(makeInjector({ history: [buy, sale], series }), sale)).toEqual({
      __typename: 'CommonError',
      message: expect.stringContaining('not available'),
    });
    expect(await resolve(makeInjector({ history: [sale] }), sale)).toEqual({
      __typename: 'CommonError',
      message: expect.stringContaining('Could not find the purchase of 10 of 10 units of MOCK'),
    });
  });
});
