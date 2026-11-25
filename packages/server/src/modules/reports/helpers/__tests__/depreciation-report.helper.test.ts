import { describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DepreciationCategoriesProvider } from '../../../depreciation/providers/depreciation-categories.provider.js';
import { DepreciationDisposalsProvider } from '../../../depreciation/providers/depreciation-disposals.provider.js';
import { DepreciationProvider } from '../../../depreciation/providers/depreciation.provider.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import type {
  IGetDepreciationDisposalsByIdsResult,
  IGetDepreciationRecordsByDatesResult,
} from '../../../depreciation/types.js';
import { calculateDepreciationAmount } from '../depreciation-report.helper.js';

vi.mock('../../../charges/helpers/common.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../charges/helpers/common.helper.js')>()),
  // the refund charge's documents (refunds from the refund date only)
  getChargeDocumentsMeta: vi.fn(async () => ({ documentsMinDate: '2023-08-20' })),
}));

/* All IDs, amounts and dates below are made up. */

const OWNER_ID = 'owner-business';
const OTHER_OWNER_ID = 'other-business';

const PERCENTAGES: Record<string, string> = {
  'category-computers': '20',
  'category-software': '33',
  'category-customer-relationships': '12.5',
  'category-goodwill': '10',
};

function record(
  overrides: Partial<IGetDepreciationRecordsByDatesResult> & {
    id: string;
    category: string;
    amount: string;
    activation_date: IGetDepreciationRecordsByDatesResult['activation_date'];
  },
): IGetDepreciationRecordsByDatesResult {
  // asserted: the row type follows the table's columns (`d.*`), which differ between stacked PRs
  return {
    charge_id: `charge-${overrides.id}`,
    currency: null,
    owner_id: OWNER_ID,
    type: 'GENERAL_AND_MANAGEMENT',
    ...overrides,
  } as IGetDepreciationRecordsByDatesResult;
}

function event(
  overrides: Partial<IGetDepreciationDisposalsByIdsResult> & {
    depreciation_id: string;
    disposal_date: IGetDepreciationDisposalsByIdsResult['disposal_date'];
    disposed_cost: string | null;
  },
): IGetDepreciationDisposalsByIdsResult {
  return {
    charge_id: null,
    created_at: new Date('2025-01-01T00:00:00.000Z'),
    description: null,
    id: `${overrides.depreciation_id}-event`,
    original_amount: null,
    original_currency: null,
    owner_id: OWNER_ID,
    proceeds: '0',
    refund_mode: null,
    type: 'WRITE_OFF',
    updated_at: new Date('2025-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeInjector(
  records: IGetDepreciationRecordsByDatesResult[],
  eventsByRecordId: Record<string, IGetDepreciationDisposalsByIdsResult[]> = {},
) {
  const loadCategory = vi.fn(async (id: string) => ({ id, percentage: PERCENTAGES[id] }));
  // ₪3.700 to the dollar on the activation date
  const getExchangeRates = vi.fn(async (_base: string, _quote: string, _date: string) => 3.7);
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      { getVerifiedAdminContext: async () => ({ defaultLocalCurrency: 'ILS' }) },
    ],
    [ExchangeProvider, { getExchangeRates }],
    [DepreciationProvider, { getDepreciationRecordsByDates: async () => records }],
    [
      DepreciationCategoriesProvider,
      { getDepreciationCategoriesByIdLoader: { load: loadCategory } },
    ],
    [
      DepreciationDisposalsProvider,
      {
        getDisposalsByDepreciationIdLoader: {
          load: async (id: string) => eventsByRecordId[id] ?? [],
        },
      },
    ],
  ]);
  const injector = { get: (token: unknown) => providers.get(token) } as unknown as Injector;
  return { injector, loadCategory, getExchangeRates };
}

describe('calculateDepreciationAmount', () => {
  /*
   * ₪10,000 at 20% (₪2,000 a year), activated on 2020-04-01: depreciation ends on 2025-03-31, so
   * 2025 is the final year. 2020 took round(2,000 × 275 / 366) = ₪1,503 and 2021-2024 ₪2,000 each,
   * leaving ₪497.
   */
  const computers = record({
    id: 'computers',
    category: 'category-computers',
    amount: '10000',
    activation_date: '2020-04-01',
  });

  it('takes the whole remaining value in the final year', async () => {
    const { injector } = makeInjector([computers]);

    // not the 90 days' share, round(2,000 × 90 / 365) = ₪493
    await expect(calculateDepreciationAmount(injector, 2025, OWNER_ID)).resolves.toEqual({
      rndDepreciationYearlyAmount: 0,
      gnmDepreciationYearlyAmount: 497,
      marketingDepreciationYearlyAmount: 0,
      totalDepreciationYearlyAmount: 497,
    });
  });

  it('pro-rates the final year to a write-off before the end date', async () => {
    const { injector } = makeInjector([computers], {
      computers: [
        event({ depreciation_id: 'computers', disposal_date: '2025-02-28', disposed_cost: '4000' }),
      ],
    });

    // to 2025-02-28: round(2,000 × 59 / 365) = ₪323 on the whole asset. The ₪4,000 slice then
    // leaves with round(9,826 × 0.4) = ₪3,930 of the accumulated depreciation, and the remaining
    // ₪6,000 takes its whole remaining value, 6,000 − 5,896 = ₪104: ₪427 in all
    await expect(calculateDepreciationAmount(injector, 2025, OWNER_ID)).resolves.toEqual({
      rndDepreciationYearlyAmount: 0,
      gnmDepreciationYearlyAmount: 427,
      marketingDepreciationYearlyAmount: 0,
      totalDepreciationYearlyAmount: 427,
    });
  });

  it("leaves out other owners' assets", async () => {
    const { injector, loadCategory } = makeInjector([
      computers,
      record({
        id: 'others-computers',
        category: 'category-computers',
        amount: '10000',
        activation_date: '2020-04-01',
        owner_id: OTHER_OWNER_ID,
        type: 'MARKETING',
      }),
    ]);

    await expect(calculateDepreciationAmount(injector, 2025, OWNER_ID)).resolves.toEqual({
      rndDepreciationYearlyAmount: 0,
      gnmDepreciationYearlyAmount: 497,
      marketingDepreciationYearlyAmount: 0,
      totalDepreciationYearlyAmount: 497,
    });
    expect(loadCategory).toHaveBeenCalledTimes(1);
  });

  describe('the acquisition cost refund (spec §3)', () => {
    /*
     * Three assets activated on 2023-08-20 (in ILS at the cost-basis rate 3.700), and the seller's
     * refund of 2024-04-14 split into one cost refund from activation per asset. The yearly charge
     * books each year's depreciation as the engine computes it: 2023 as filed, 2024 on the corrected
     * cost. The recapture is booked by the refund charge, never here.
     */
    const assets = [
      record({
        id: 'software',
        category: 'category-software',
        amount: '592000',
        activation_date: '2023-08-20',
        type: 'RESEARCH_AND_DEVELOPMENT',
      }),
      record({
        id: 'customer-relationships',
        category: 'category-customer-relationships',
        amount: '740000',
        activation_date: '2023-08-20',
      }),
      record({
        id: 'goodwill',
        category: 'category-goodwill',
        amount: '222000',
        activation_date: '2023-08-20',
      }),
    ];
    const refund = (depreciationId: string, amount: string) =>
      event({
        depreciation_id: depreciationId,
        disposal_date: '2024-04-14',
        disposed_cost: amount,
        charge_id: 'charge-refund',
        type: 'COST_REFUND',
        refund_mode: 'FROM_ACTIVATION',
      });
    const refunds = {
      software: [refund('software', '59200')],
      'customer-relationships': [refund('customer-relationships', '74000')],
      goodwill: [refund('goodwill', '222000')],
    };

    it('keeps 2023 as filed after the 2024 refunds are entered', async () => {
      const { injector } = makeInjector(assets, refunds);

      await expect(calculateDepreciationAmount(injector, 2023, OWNER_ID)).resolves.toEqual({
        rndDepreciationYearlyAmount: 71_721,
        gnmDepreciationYearlyAmount: 33_959 + 8150,
        marketingDepreciationYearlyAmount: 0,
        totalDepreciationYearlyAmount: 113_830,
      });
    });

    it('books 2024 on the corrected cost, without the recapture and with no goodwill', async () => {
      const { injector } = makeInjector(assets, refunds);

      await expect(calculateDepreciationAmount(injector, 2024, OWNER_ID)).resolves.toEqual({
        rndDepreciationYearlyAmount: 175_824,
        gnmDepreciationYearlyAmount: 83_250,
        marketingDepreciationYearlyAmount: 0,
        totalDepreciationYearlyAmount: 259_074,
      });
    });

    describe('recorded in USD, as paid (no local cost overrides)', () => {
      // the same assets in USD, converted at the activation date's ₪3.700, and the refunds entered
      // in USD: converted at the assets' cost-basis rate, the same ₪59,200 / ₪74,000 / ₪222,000
      const usd = (id: string, amount: string) => {
        const asset = assets.find(a => a.id === id)!;
        return { ...asset, amount, currency: 'USD' as const };
      };
      const usdAssets = [
        usd('software', '160000'),
        usd('customer-relationships', '200000'),
        usd('goodwill', '60000'),
      ];
      const usdRefund = (depreciationId: string, amount: string) =>
        event({
          depreciation_id: depreciationId,
          disposal_date: '2024-04-14',
          disposed_cost: null,
          original_amount: amount,
          original_currency: 'USD',
          charge_id: 'charge-refund',
          type: 'COST_REFUND',
          refund_mode: 'FROM_ACTIVATION',
        });
      const usdRefunds = {
        software: [usdRefund('software', '16000')],
        'customer-relationships': [usdRefund('customer-relationships', '20000')],
        goodwill: [usdRefund('goodwill', '60000')],
      };

      it('keeps 2023 as filed', async () => {
        const { injector, getExchangeRates } = makeInjector(usdAssets, usdRefunds);

        await expect(calculateDepreciationAmount(injector, 2023, OWNER_ID)).resolves.toEqual({
          rndDepreciationYearlyAmount: 71_721,
          gnmDepreciationYearlyAmount: 33_959 + 8150,
          marketingDepreciationYearlyAmount: 0,
          totalDepreciationYearlyAmount: 113_830,
        });
        expect(getExchangeRates).toHaveBeenCalledWith('USD', 'ILS', '2023-08-20');
      });

      it('books 2024 on the corrected cost', async () => {
        const { injector } = makeInjector(usdAssets, usdRefunds);

        await expect(calculateDepreciationAmount(injector, 2024, OWNER_ID)).resolves.toEqual({
          rndDepreciationYearlyAmount: 175_824,
          gnmDepreciationYearlyAmount: 83_250,
          marketingDepreciationYearlyAmount: 0,
          totalDepreciationYearlyAmount: 259_074,
        });
      });

      it('takes a local cost override over the converted amount', async () => {
        // software overridden at its ₪592,000: no rate lookup, the same depreciation
        const { injector, getExchangeRates } = makeInjector(
          [{ ...usd('software', '160000'), local_amount: '592000' }],
          { software: usdRefunds.software },
        );

        await expect(calculateDepreciationAmount(injector, 2024, OWNER_ID)).resolves.toEqual({
          rndDepreciationYearlyAmount: 175_824,
          gnmDepreciationYearlyAmount: 0,
          marketingDepreciationYearlyAmount: 0,
          totalDepreciationYearlyAmount: 175_824,
        });
        expect(getExchangeRates).not.toHaveBeenCalled();
      });
    });
  });
});
