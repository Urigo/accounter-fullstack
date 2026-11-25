import { describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { Currency } from '../../../../shared/enums.js';
import type { LedgerProto, TimelessDateString } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { getChargeTaxCategoryId } from '../../../charges/helpers/common.helper.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import type {
  AssetDepreciationInput,
  AssetDisposalInput,
  CostRefundMode,
  DepreciationDisposalKind,
} from '../../../depreciation/helpers/asset-depreciation.helper.js';
import {
  computeAssetEvent,
  computeStoredDisposal,
  loadAssetContext,
  type AssetContext,
  type DisposalComputation,
} from '../../../depreciation/helpers/depreciation-disposals.helper.js';
import type { IGetDepreciationDisposalsByIdsResult } from '../../../depreciation/types.js';
import {
  buildDisposalLedgerEntries,
  checkDisposalProceeds,
  correctedYears,
  generateDepreciationDisposalsLedger,
  type DisposalLedgerAccounts,
} from '../depreciation-disposal-ledger.helper.js';

vi.mock('../../../depreciation/helpers/depreciation-disposals.helper.js', async importOriginal => ({
  ...(await importOriginal<
    typeof import('../../../depreciation/helpers/depreciation-disposals.helper.js')
  >()),
  loadAssetContext: vi.fn(),
  computeStoredDisposal: vi.fn(),
}));

vi.mock('../../../charges/helpers/common.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../charges/helpers/common.helper.js')>()),
  getChargeTaxCategoryId: vi.fn(),
}));

const ASSET = 'tax-category-computers';
const AD = 'tax-category-accumulated-depreciation';
const GAIN = 'tax-category-disposal-gain';
const LOSS = 'tax-category-disposal-loss';
const CORRECTION = 'tax-category-depreciation-correction';
const CLEARING = 'tax-category-asset-sale-proceeds';
const DATE = '2025-07-01' as TimelessDateString;
const ACTIVATION = '2023-03-01' as TimelessDateString;

const ACCOUNTS: DisposalLedgerAccounts = {
  assetAccountId: ASSET,
  accumulatedDepreciationAccountId: AD,
  proceedsAccountId: ASSET,
  gainAccountId: GAIN,
  lossAccountId: LOSS,
  correctionAccountId: CORRECTION,
};

function build(options: {
  kind: DepreciationDisposalKind;
  refundMode?: CostRefundMode;
  result: Partial<DisposalComputation>;
  accounts?: Partial<DisposalLedgerAccounts>;
  disposalDate?: TimelessDateString;
  activationDate?: TimelessDateString;
}) {
  return buildDisposalLedgerEntries({
    disposal: {
      id: 'disposal',
      kind: options.kind,
      refundMode: options.refundMode,
      disposalDate: options.disposalDate ?? DATE,
    },
    activationDate: options.activationDate ?? ACTIVATION,
    result: {
      disposedCost: 0,
      proceeds: 0,
      accumulatedDepreciation: 0,
      netBookValue: 0,
      gainLoss: 0,
      costReduction: 0,
      depreciationCorrection: 0,
      ...options.result,
    },
    accounts: { ...ACCOUNTS, ...options.accounts },
    chargeId: 'charge',
    ownerId: 'owner',
    currency: Currency.Ils,
  });
}

/** [debit, credit, amount, description] per entry */
function rows(entries: LedgerProto[]) {
  return entries.map(entry => [
    entry.debitAccountID1,
    entry.creditAccountID1,
    entry.localCurrencyDebitAmount1,
    entry.description,
  ]);
}

/** Net debit per account (credit negative) */
function net(entries: LedgerProto[]) {
  const balance = new Map<string, number>();
  for (const entry of entries) {
    balance.set(
      entry.debitAccountID1!,
      (balance.get(entry.debitAccountID1!) ?? 0) + entry.localCurrencyDebitAmount1,
    );
    balance.set(
      entry.creditAccountID1!,
      (balance.get(entry.creditAccountID1!) ?? 0) - entry.localCurrencyCreditAmount1,
    );
  }
  return Object.fromEntries([...balance.entries()].filter(([, amount]) => amount !== 0));
}

describe('buildDisposalLedgerEntries', () => {
  describe('sales and write-offs', () => {
    it('removes the disposed cost from the asset on a sale at a loss', () => {
      const { entries, errors } = build({
        kind: 'SALE',
        result: {
          disposedCost: 100_000,
          accumulatedDepreciation: 18_732,
          netBookValue: 81_268,
          proceeds: 50_000,
          gainLoss: -31_268,
        },
      });
      expect(errors).toEqual([]);
      // with the charge's own Cr asset 50,000, the asset is credited the full 100,000
      expect(net(entries)).toEqual({ [AD]: 18_732, [LOSS]: 31_268, [ASSET]: -50_000 });
      expect(entries.every(entry => entry.valueDate === DATE && entry.invoiceDate === DATE)).toBe(
        true,
      );
    });

    it('moves proceeds booked to another account onto the asset', () => {
      const { entries } = build({
        kind: 'SALE',
        result: {
          disposedCost: 100_000,
          accumulatedDepreciation: 37_568,
          netBookValue: 62_432,
          proceeds: 70_000,
          gainLoss: 7568,
        },
        accounts: { proceedsAccountId: CLEARING },
      });
      expect(rows(entries)).toEqual([
        [CLEARING, ASSET, 70_000, 'Asset disposal: proceeds'],
        [AD, ASSET, 37_568, 'Asset disposal: accumulated depreciation'],
        [ASSET, GAIN, 7568, 'Asset disposal: gain'],
      ]);
      expect(net(entries)).toEqual({
        [CLEARING]: 70_000,
        [AD]: 37_568,
        [GAIN]: -7568,
        [ASSET]: -100_000,
      });
    });

    it('writes off a fully depreciated asset with no gain or loss', () => {
      const { entries, errors } = build({
        kind: 'WRITE_OFF',
        result: { disposedCost: 10_000, accumulatedDepreciation: 10_000, netBookValue: 0 },
        accounts: { proceedsAccountId: null },
      });
      expect(errors).toEqual([]);
      expect(net(entries)).toEqual({ [AD]: 10_000, [ASSET]: -10_000 });
    });

    it('reports a missing gain or loss category', () => {
      const { errors } = build({
        kind: 'WRITE_OFF',
        result: { disposedCost: 1000, netBookValue: 1000, gainLoss: -1000 },
        accounts: { gainAccountId: null, lossAccountId: null },
      });
      expect(errors).toEqual(['Loss on disposal of fixed assets tax category is not defined']);
    });
  });

  describe('cost refunds', () => {
    it('reduces the cost and books the recapture of a refund from activation as income', () => {
      // ₪20,000 refunded in 2025 on an asset activated in 2023: the 2023-2024 depreciation booked
      // on the refunded part, ₪1,500, is recaptured
      const { entries, errors } = build({
        kind: 'COST_REFUND',
        refundMode: 'FROM_ACTIVATION',
        result: {
          disposedCost: 20_000,
          accumulatedDepreciation: 1500,
          netBookValue: 18_500,
          costReduction: 20_000,
          depreciationCorrection: 1500,
        },
        accounts: { proceedsAccountId: CLEARING },
      });
      expect(errors).toEqual([]);
      expect(rows(entries)).toEqual([
        [CLEARING, ASSET, 20_000, 'Asset cost refund: cost reduction'],
        [AD, CORRECTION, 1500, 'Asset cost refund: depreciation correction for 2023-2024'],
      ]);
      expect(entries.every(entry => entry.valueDate === DATE && entry.invoiceDate === DATE)).toBe(
        true,
      );
      // the charge's own Cr clearing 20,000 is cleared; no gain or loss
      expect(net(entries)).toEqual({
        [CLEARING]: 20_000,
        [ASSET]: -20_000,
        [AD]: 1500,
        [CORRECTION]: -1500,
      });
    });

    it('books only the excess over book value of a refund from the refund date', () => {
      // ₪30,000 refunded on an asset with ₪28,000 of book value left: ₪2,000 of the depreciation
      // booked up to the refund date is reversed
      const { entries, errors } = build({
        kind: 'COST_REFUND',
        refundMode: 'FROM_REFUND_DATE',
        activationDate: '2021-01-01' as TimelessDateString,
        result: {
          disposedCost: 30_000,
          accumulatedDepreciation: 2000,
          netBookValue: 28_000,
          costReduction: 30_000,
          depreciationCorrection: 2000,
        },
        accounts: { proceedsAccountId: CLEARING },
      });
      expect(errors).toEqual([]);
      expect(rows(entries)).toEqual([
        [CLEARING, ASSET, 30_000, 'Asset cost refund: cost reduction'],
        [AD, CORRECTION, 2000, 'Asset cost refund: depreciation correction for 2021-2025'],
      ]);
    });

    it('books no correction for a refund within the book value', () => {
      const { entries, errors } = build({
        kind: 'COST_REFUND',
        refundMode: 'FROM_REFUND_DATE',
        result: { disposedCost: 5000, netBookValue: 5000, costReduction: 5000 },
        accounts: { proceedsAccountId: CLEARING },
      });
      expect(errors).toEqual([]);
      expect(net(entries)).toEqual({ [CLEARING]: 5000, [ASSET]: -5000 });
    });

    it('skips the cost reduction when the refund was booked to the asset account', () => {
      const { entries, errors } = build({
        kind: 'COST_REFUND',
        result: { costReduction: 20_000, depreciationCorrection: 1500 },
        accounts: { proceedsAccountId: ASSET },
      });
      expect(errors).toEqual([]);
      expect(rows(entries)).toEqual([
        [AD, CORRECTION, 1500, 'Asset cost refund: depreciation correction for 2023-2024'],
      ]);
    });

    it('reports a missing depreciation correction category', () => {
      const { entries, errors } = build({
        kind: 'COST_REFUND',
        result: { costReduction: 20_000, depreciationCorrection: 1500 },
        accounts: { proceedsAccountId: CLEARING, correctionAccountId: null },
      });
      expect(errors).toEqual(['Depreciation correction tax category is not defined']);
      expect(rows(entries)).toEqual([
        [CLEARING, ASSET, 20_000, 'Asset cost refund: cost reduction'],
      ]);
    });

    it('reports a refund charge with no tax category', () => {
      const { errors } = build({
        kind: 'COST_REFUND',
        result: { costReduction: 20_000 },
        accounts: { proceedsAccountId: null },
      });
      expect(errors).toEqual([
        'Asset cost refund disposal: the refund charge has no tax category to take the refund from',
      ]);
    });
  });

  describe('the acquisition cost refund (spec §4, refund charge)', () => {
    /*
     * Four assets activated on 2023-08-20 (in ILS at the cost-basis rate 3.700), and the seller's
     * refund of 2024-04-14, split into one cost refund from activation per asset. The refund charge
     * credits the refund to a clearing account P.
     */
    const activationDate = '2023-08-20' as TimelessDateString;
    const refundDate = '2024-04-14' as TimelessDateString;

    const assets: Array<{
      account: string;
      asset: AssetDepreciationInput;
      refund: AssetDisposalInput;
    }> = [
      {
        account: 'tax-category-goodwill',
        asset: { cost: 222_000, depreciationRate: 10, activationDate },
        refund: refundOf('goodwill', 222_000),
      },
      {
        account: 'tax-category-software',
        asset: { cost: 592_000, depreciationRate: 33, activationDate },
        refund: refundOf('software', 59_200),
      },
      {
        account: 'tax-category-customer-relationships',
        asset: { cost: 740_000, depreciationRate: 12.5, activationDate },
        refund: refundOf('customer-relationships', 74_000),
      },
      {
        account: 'tax-category-trademarks',
        asset: { cost: 148_000, depreciationRate: 0, activationDate },
        refund: refundOf('trademarks', 14_800),
      },
    ];

    function refundOf(id: string, amount: number): AssetDisposalInput {
      return {
        id,
        kind: 'COST_REFUND',
        refundMode: 'FROM_ACTIVATION',
        disposalDate: refundDate,
        disposedCost: amount,
        proceeds: 0,
      };
    }

    const built = assets.map(({ account, asset, refund }) => {
      const result = computeAssetEvent(asset, [refund], refund.id);
      if (!result) {
        throw new Error(`Unable to compute ${refund.id}`);
      }
      return {
        result,
        ...buildDisposalLedgerEntries({
          disposal: {
            id: refund.id,
            kind: 'COST_REFUND',
            refundMode: 'FROM_ACTIVATION',
            disposalDate: refundDate,
          },
          activationDate,
          result,
          accounts: { ...ACCOUNTS, assetAccountId: account, proceedsAccountId: CLEARING },
          chargeId: 'charge-refund',
          ownerId: 'owner',
          currency: Currency.Ils,
        }),
      };
    });

    it('reduces each cost and books the 2023 recaptures as corrections, with no gain rows', () => {
      expect(built.flatMap(({ errors }) => errors)).toEqual([]);
      expect(built.map(({ entries }) => rows(entries))).toEqual([
        [
          [CLEARING, 'tax-category-goodwill', 222_000, 'Asset cost refund: cost reduction'],
          [AD, CORRECTION, 8150, 'Asset cost refund: depreciation correction for 2023'],
        ],
        [
          [CLEARING, 'tax-category-software', 59_200, 'Asset cost refund: cost reduction'],
          [AD, CORRECTION, 7172, 'Asset cost refund: depreciation correction for 2023'],
        ],
        [
          [
            CLEARING,
            'tax-category-customer-relationships',
            74_000,
            'Asset cost refund: cost reduction',
          ],
          [AD, CORRECTION, 3396, 'Asset cost refund: depreciation correction for 2023'],
        ],
        // trademarks are not depreciated: nothing to recapture
        [[CLEARING, 'tax-category-trademarks', 14_800, 'Asset cost refund: cost reduction']],
      ]);
      expect(built.map(({ result }) => result.gainLoss)).toEqual([0, 0, 0, 0]);
      const entries = built.flatMap(({ entries }) => entries);
      expect(
        entries.some(entry =>
          [GAIN, LOSS].some(
            account => entry.debitAccountID1 === account || entry.creditAccountID1 === account,
          ),
        ),
      ).toBe(false);
      expect(
        entries.every(entry => entry.valueDate === refundDate && entry.invoiceDate === refundDate),
      ).toBe(true);
      expect(net(entries)).toMatchObject({
        [CLEARING]: 370_000,
        [AD]: 18_718,
        [CORRECTION]: -18_718,
      });
    });
  });
});

describe('correctedYears', () => {
  it('names the years before the refund year for a refund from activation', () => {
    const d = (date: string) => date as TimelessDateString;
    expect(correctedYears(d('2023-08-20'), d('2024-04-14'), 'FROM_ACTIVATION')).toBe('2023');
    expect(correctedYears(d('2021-01-01'), d('2024-04-14'), 'FROM_ACTIVATION')).toBe('2021-2023');
    expect(correctedYears(d('2021-01-01'), d('2024-04-14'), 'FROM_REFUND_DATE')).toBe('2021-2024');
    expect(correctedYears(d('2024-01-01'), d('2024-04-14'), 'FROM_REFUND_DATE')).toBe('2024');
  });
});

describe('checkDisposalProceeds', () => {
  const entry = (debit: string, credit: string, amount: number): LedgerProto => ({
    id: 'entry',
    chargeId: 'charge',
    ownerId: 'owner',
    invoiceDate: DATE,
    valueDate: DATE,
    currency: Currency.Ils,
    isCreditorCounterparty: true,
    debitAccountID1: debit,
    creditAccountID1: credit,
    localCurrencyDebitAmount1: amount,
    localCurrencyCreditAmount1: amount,
  });

  it('accepts a charge that credits its tax category with the events’ money', () => {
    expect(
      checkDisposalProceeds({
        expectedProceeds: 20_000,
        proceedsAccountId: CLEARING,
        chargeEntries: [entry('supplier', CLEARING, 20_000), entry('bank', 'supplier', 20_000)],
      }),
    ).toBeNull();
  });

  it('reports the difference otherwise', () => {
    expect(
      checkDisposalProceeds({
        expectedProceeds: 25_000,
        proceedsAccountId: CLEARING,
        chargeEntries: [
          entry('supplier', CLEARING, 20_000),
          {
            ...entry('supplier', 'tax-category-vat', 0),
            creditAccountID2: CLEARING,
            localCurrencyCreditAmount2: 1000,
          },
        ],
      }),
    ).toBe(
      `Sales and cost refunds of depreciated assets come to 25,000.00, but the charge credits 21,000.00 to its tax category "${CLEARING}" (-4,000.00 diff): book the refund to the asset's account, or set the charge's tax category to the account it is credited to`,
    );
  });
});

describe('generateDepreciationDisposalsLedger', () => {
  /*
   * Two cost refunds on one refund charge, each of a different asset. The engine's results and the
   * assets are stubbed; the asset account is the tax category of the asset's purchase charge.
   */
  const REFUND_CHARGE = { id: 'charge-refund', owner_id: 'owner' };

  function refund(id: string, depreciationId: string): IGetDepreciationDisposalsByIdsResult {
    return {
      charge_id: REFUND_CHARGE.id,
      created_at: new Date('2025-07-01T00:00:00.000Z'),
      depreciation_id: depreciationId,
      description: null,
      disposal_date: DATE,
      disposed_cost: '20000',
      id,
      original_amount: null,
      original_currency: null,
      owner_id: 'owner',
      proceeds: '0',
      refund_mode: 'FROM_ACTIVATION',
      type: 'COST_REFUND',
      updated_at: new Date('2025-07-01T00:00:00.000Z'),
    };
  }

  const injector = {
    get: (token: unknown) => {
      if (token === AdminContextProvider) {
        return {
          getVerifiedAdminContext: async () => ({
            defaultLocalCurrency: Currency.Ils,
            depreciation: {
              accumulatedDepreciationTaxCategoryId: AD,
              disposalGainTaxCategoryId: GAIN,
              disposalLossTaxCategoryId: LOSS,
              correctionTaxCategoryId: CORRECTION,
            },
          }),
        };
      }
      if (token === ChargesProvider) {
        return { getChargeByIdLoader: { load: async () => ({ user_description: null }) } };
      }
      throw new Error(`Unexpected provider token: ${String(token)}`);
    },
  } as unknown as Injector;

  function stubAssets(assetAccounts: Record<string, string | null>) {
    vi.mocked(loadAssetContext).mockImplementation(
      async (_injector, depreciationId) =>
        ({
          record: { charge_id: `charge-${depreciationId}`, activation_date: ACTIVATION },
        }) as AssetContext,
    );
    vi.mocked(computeStoredDisposal).mockResolvedValue({
      disposedCost: 20_000,
      proceeds: 0,
      accumulatedDepreciation: 1500,
      netBookValue: 18_500,
      gainLoss: 0,
      costReduction: 20_000,
      depreciationCorrection: 1500,
    });
    vi.mocked(getChargeTaxCategoryId).mockImplementation(
      async chargeRef => assetAccounts[String(chargeRef).replace('charge-', '')] ?? null,
    );
  }

  it('expects the cost reductions of all the events on the charge', async () => {
    stubAssets({ laptops: 'tax-category-laptops', servers: 'tax-category-servers' });

    const ledger = await generateDepreciationDisposalsLedger(
      [refund('laptops-refund', 'laptops'), refund('servers-refund', 'servers')],
      REFUND_CHARGE,
      injector,
      CLEARING,
    );

    expect(ledger.errors).toEqual([]);
    expect(ledger.entries).toHaveLength(4);
    expect(ledger.expectedProceeds).toBe(40_000);
  });

  it("expects nothing when an event's rows can't be built", async () => {
    // neither the servers' record nor its purchase charge names an asset account to credit
    stubAssets({ laptops: 'tax-category-laptops', servers: null });

    const ledger = await generateDepreciationDisposalsLedger(
      [refund('laptops-refund', 'laptops'), refund('servers-refund', 'servers')],
      REFUND_CHARGE,
      injector,
      CLEARING,
    );

    expect(ledger.errors).toEqual([
      'Asset disposal servers-refund: the asset has no account: set its asset account, or a tax category on the charge that bought it',
    ]);
    // the laptops' rows only: nothing moves the servers' refund out of the clearing account
    expect(rows(ledger.entries)).toEqual([
      [CLEARING, 'tax-category-laptops', 20_000, 'Asset cost refund: cost reduction'],
      [AD, CORRECTION, 1500, 'Asset cost refund: depreciation correction for 2023-2024'],
    ]);
    expect(ledger.expectedProceeds).toBeNull();
  });
});
