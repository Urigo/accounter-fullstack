import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { Currency } from '../../../../shared/enums.js';
import type { LedgerProto } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import {
  getChargeDocumentsMeta,
  getChargeTaxCategoryId,
} from '../../../charges/helpers/common.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { DepreciationCategoriesProvider } from '../../../depreciation/providers/depreciation-categories.provider.js';
import { DepreciationDisposalsProvider } from '../../../depreciation/providers/depreciation-disposals.provider.js';
import { DepreciationProvider } from '../../../depreciation/providers/depreciation.provider.js';
import type {
  IGetDepreciationDisposalsByIdsResult,
  IGetDepreciationRecordsByIdsResult,
} from '../../../depreciation/types.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import {
  generateDepreciationDisposalsLedger,
  getAssetAccountId,
} from '../depreciation-disposal-ledger.helper.js';

vi.mock('../../../charges/helpers/common.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../charges/helpers/common.helper.js')>()),
  getChargeTaxCategoryId: vi.fn(),
  // the refund charge's documents (refunds from the refund date only)
  getChargeDocumentsMeta: vi.fn(async () => ({ documentsMinDate: '2023-08-20' })),
}));

/*
 * The acquisition case (all names and amounts fictional): one charge buys four assets for USD,
 * booked through misc expenses, so the charge has no tax category of its own. Each depreciation
 * record names its asset account. The seller's refund of 2024-04-14 is split into one cost refund
 * from activation per asset, entered in USD, and credited by the refund charge to a clearing
 * account P.
 */

const OWNER_ID = 'owner-business';
const ACQUISITION_CHARGE_ID = 'charge-acquisition';
const REFUND_CHARGE_ID = 'charge-refund';
const CLEARING = 'tax-category-refund-clearing';
const AD = 'tax-category-accumulated-depreciation';
const CORRECTION = 'tax-category-depreciation-correction';

const PERCENTAGES: Record<string, string> = {
  'category-software': '33',
  'category-customer-relationships': '12.5',
  'category-goodwill': '10',
  'category-trademarks': '0',
};

function asset(
  id: string,
  amount: string,
  category: string,
  assetTaxCategoryId: string | null,
): IGetDepreciationRecordsByIdsResult {
  return {
    id,
    activation_date: '2023-08-20',
    amount,
    asset_tax_category_id: assetTaxCategoryId,
    category,
    charge_id: ACQUISITION_CHARGE_ID,
    currency: 'USD',
    local_amount: null,
    owner_id: OWNER_ID,
    type: 'GENERAL_AND_MANAGEMENT',
  };
}

function usdRefund(depreciationId: string, amount: string): IGetDepreciationDisposalsByIdsResult {
  return {
    id: `refund-${depreciationId}`,
    charge_id: REFUND_CHARGE_ID,
    created_at: new Date('2024-04-15T00:00:00.000Z'),
    depreciation_id: depreciationId,
    description: null,
    disposal_date: '2024-04-14',
    disposed_cost: null,
    original_amount: amount,
    original_currency: 'USD',
    owner_id: OWNER_ID,
    proceeds: '0',
    refund_mode: 'FROM_ACTIVATION',
    type: 'COST_REFUND',
    updated_at: new Date('2024-04-15T00:00:00.000Z'),
  };
}

function makeInjector(
  records: IGetDepreciationRecordsByIdsResult[],
  refunds: IGetDepreciationDisposalsByIdsResult[],
): Injector {
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: async () => ({
          defaultLocalCurrency: Currency.Ils,
          depreciation: {
            accumulatedDepreciationTaxCategoryId: AD,
            disposalGainTaxCategoryId: 'tax-category-disposal-gain',
            disposalLossTaxCategoryId: 'tax-category-disposal-loss',
            correctionTaxCategoryId: CORRECTION,
          },
        }),
      },
    ],
    // ₪3.700 to the dollar on the activation date
    [ExchangeProvider, { getExchangeRates: async () => 3.7 }],
    [
      DepreciationProvider,
      {
        getDepreciationRecordByIdLoader: {
          load: async (id: string) => records.find(record => record.id === id),
        },
      },
    ],
    [
      DepreciationDisposalsProvider,
      {
        getDisposalsByDepreciationIdLoader: {
          load: async (id: string) => refunds.filter(refund => refund.depreciation_id === id),
        },
      },
    ],
    [
      DepreciationCategoriesProvider,
      {
        getDepreciationCategoriesByIdLoader: {
          load: async (id: string) => ({ id, percentage: PERCENTAGES[id] }),
        },
      },
    ],
    [
      ChargesProvider,
      {
        getChargeByIdLoader: {
          load: async (id: string) => ({ id, owner_id: OWNER_ID, user_description: null }),
        },
      },
    ],
  ]);
  return {
    get: (token: unknown) => {
      if (!providers.has(token)) {
        throw new Error(`Unexpected provider token: ${String(token)}`);
      }
      return providers.get(token);
    },
  } as unknown as Injector;
}

/** [debit, credit, amount] of the cost-reduction rows */
function costReductions(entries: LedgerProto[]) {
  return entries
    .filter(entry => entry.description?.endsWith('cost reduction'))
    .map(entry => [entry.debitAccountID1, entry.creditAccountID1, entry.localCurrencyDebitAmount1]);
}

describe('the asset account of a disposal', () => {
  beforeEach(() => {
    vi.mocked(getChargeTaxCategoryId).mockReset();
    vi.mocked(getChargeDocumentsMeta).mockClear();
  });

  const assets = [
    asset('goodwill', '60000', 'category-goodwill', 'tax-category-goodwill'),
    asset('software', '160000', 'category-software', 'tax-category-software'),
    asset(
      'customer-relationships',
      '200000',
      'category-customer-relationships',
      'tax-category-customer-relationships',
    ),
    asset('trademarks', '40000', 'category-trademarks', 'tax-category-trademarks'),
  ];
  const refunds = [
    usdRefund('goodwill', '60000'),
    usdRefund('software', '16000'),
    usdRefund('customer-relationships', '20000'),
    usdRefund('trademarks', '4000'),
  ];

  it("credits each refund to its own asset's account, for a charge buying several assets", async () => {
    // the acquisition charge has no tax category of its own
    vi.mocked(getChargeTaxCategoryId).mockResolvedValue(null);

    const { entries, errors, expectedProceeds } = await generateDepreciationDisposalsLedger(
      refunds,
      { id: REFUND_CHARGE_ID, owner_id: OWNER_ID },
      makeInjector(assets, refunds),
      CLEARING,
    );

    // the USD refunds at the assets' ₪3.700
    expect(errors).toEqual([]);
    expect(costReductions(entries)).toEqual([
      [CLEARING, 'tax-category-goodwill', 222_000],
      [CLEARING, 'tax-category-software', 59_200],
      [CLEARING, 'tax-category-customer-relationships', 74_000],
      [CLEARING, 'tax-category-trademarks', 14_800],
    ]);
    expect(expectedProceeds).toBe(370_000);
    expect(getChargeTaxCategoryId).not.toHaveBeenCalled();
  });

  it("falls back to the purchase charge's tax category", async () => {
    vi.mocked(getChargeTaxCategoryId).mockResolvedValue('tax-category-software');
    const software = asset('software', '160000', 'category-software', null);
    const refund = usdRefund('software', '16000');

    const { entries, errors } = await generateDepreciationDisposalsLedger(
      [refund],
      { id: REFUND_CHARGE_ID, owner_id: OWNER_ID },
      makeInjector([software], [refund]),
      CLEARING,
    );

    expect(errors).toEqual([]);
    expect(costReductions(entries)).toEqual([[CLEARING, 'tax-category-software', 59_200]]);
    expect(getChargeTaxCategoryId).toHaveBeenCalledWith(ACQUISITION_CHARGE_ID, expect.anything());
  });

  it('reports an asset with neither its own account nor a charge tax category', async () => {
    vi.mocked(getChargeTaxCategoryId).mockResolvedValue(null);
    const software = asset('software', '160000', 'category-software', null);
    const refund = usdRefund('software', '16000');

    const { entries, errors } = await generateDepreciationDisposalsLedger(
      [refund],
      { id: REFUND_CHARGE_ID, owner_id: OWNER_ID },
      makeInjector([software], [refund]),
      CLEARING,
    );

    expect(entries).toEqual([]);
    expect(errors).toEqual([
      'Asset disposal refund-software: the asset has no account: set its asset account, or a tax category on the charge that bought it',
    ]);
  });
});

describe('getAssetAccountId', () => {
  it("takes the record's account over the charge's tax category", async () => {
    vi.mocked(getChargeTaxCategoryId).mockResolvedValue('tax-category-charge');
    const injector = {} as Injector;

    await expect(
      getAssetAccountId(
        { asset_tax_category_id: 'tax-category-own', charge_id: ACQUISITION_CHARGE_ID },
        injector,
      ),
    ).resolves.toBe('tax-category-own');
    await expect(
      getAssetAccountId({ asset_tax_category_id: null, charge_id: ACQUISITION_CHARGE_ID }, injector),
    ).resolves.toBe('tax-category-charge');
  });
});

describe('the currency of disposal rows', () => {
  beforeEach(() => {
    vi.mocked(getChargeTaxCategoryId).mockReset();
  });

  it("books a refund entered in the asset's currency in that currency, at its rate", async () => {
    // USD 16,000 of the USD 160,000 software, from activation at its ₪3.700: ₪59,200, and the 2023
    // depreciation it reverses, ₪7,172 (USD 1,938.38)
    const software = asset('software', '160000', 'category-software', 'tax-category-software');
    const refund = usdRefund('software', '16000');

    const { entries, errors } = await generateDepreciationDisposalsLedger(
      [refund],
      { id: REFUND_CHARGE_ID, owner_id: OWNER_ID },
      makeInjector([software], [refund]),
      CLEARING,
    );

    expect(errors).toEqual([]);
    expect(entries).toHaveLength(2);
    const [costReduction, correction] = entries;
    expect(costReduction).toMatchObject({
      debitAccountID1: CLEARING,
      creditAccountID1: 'tax-category-software',
      currency: Currency.Usd,
      // the refunded amount itself, so the row ties to the refund
      debitAmount1: 16_000,
      creditAmount1: 16_000,
      localCurrencyDebitAmount1: 59_200,
      localCurrencyCreditAmount1: 59_200,
    });
    expect(costReduction.currencyRate).toBeCloseTo(3.7);
    expect(correction).toMatchObject({
      debitAccountID1: AD,
      creditAccountID1: CORRECTION,
      currency: Currency.Usd,
      debitAmount1: 1938.38,
      creditAmount1: 1938.38,
      localCurrencyDebitAmount1: 7172,
      localCurrencyCreditAmount1: 7172,
    });
    expect(correction.currencyRate).toBeCloseTo(3.7);
  });

  it('keeps the rows of a refund of a local-currency asset in the local currency', async () => {
    const laptops = {
      ...asset('laptops', '592000', 'category-software', 'tax-category-laptops'),
      currency: 'ILS' as const,
    };
    const refund: IGetDepreciationDisposalsByIdsResult = {
      ...usdRefund('laptops', '0'),
      disposed_cost: '59200',
      original_amount: null,
      original_currency: null,
    };

    const { entries, errors } = await generateDepreciationDisposalsLedger(
      [refund],
      { id: REFUND_CHARGE_ID, owner_id: OWNER_ID },
      makeInjector([laptops], [refund]),
      CLEARING,
    );

    expect(errors).toEqual([]);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.currency).toBe(Currency.Ils);
      expect(entry.currencyRate).toBe(1);
      expect(entry.debitAmount1).toBeUndefined();
      expect(entry.creditAmount1).toBeUndefined();
    }
    expect(costReductions(entries)).toEqual([[CLEARING, 'tax-category-laptops', 59_200]]);
  });
});
