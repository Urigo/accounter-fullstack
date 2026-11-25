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
import {
  generateCostRefundExchangeLedger,
  netCreditToAccount,
} from '../depreciation-refund-exchange-ledger.helper.js';

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
const EXCHANGE_RATES = 'tax-category-exchange-rates';
const SELLER = 'business-seller';
const REFUND_DATE = '2024-04-14';

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
          general: { taxCategories: { exchangeRateTaxCategoryId: EXCHANGE_RATES } },
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

/**
 * A row of the refund charge's own entries (a transaction, misc expense or credit note): Dr
 * `debitAccountId` / Cr `creditAccountId` with `usd`, at the refund date's ₪3.650
 */
function usdEntry(debitAccountId: string, creditAccountId: string, usd: number): LedgerProto {
  return {
    id: `entry-${debitAccountId}-${creditAccountId}-${usd}`,
    chargeId: REFUND_CHARGE_ID,
    ownerId: OWNER_ID,
    invoiceDate: REFUND_DATE,
    valueDate: REFUND_DATE,
    currency: Currency.Usd,
    currencyRate: 3.65,
    isCreditorCounterparty: true,
    debitAccountID1: debitAccountId,
    creditAccountID1: creditAccountId,
    debitAmount1: usd,
    creditAmount1: usd,
    localCurrencyDebitAmount1: usd * 3.65,
    localCurrencyCreditAmount1: usd * 3.65,
    description: 'misc expense',
  };
}

/** [debit, credit, amount] of the rows */
function rows(entries: LedgerProto[]) {
  return entries.map(entry => [
    entry.debitAccountID1,
    entry.creditAccountID1,
    entry.localCurrencyDebitAmount1,
  ]);
}

/** The USD amounts of the cost-reduction rows */
function costReductionsInUsd(entries: LedgerProto[]) {
  return entries
    .filter(entry => entry.description?.endsWith('cost reduction'))
    .map(entry => entry.debitAmount1);
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

describe('a cost refund booked by its record', () => {
  /*
   * The acquisition booked the software and the customer relationships to one acquisition account
   * A, by misc expenses. The seller refunds USD 36,000 of their price with no credit note: the
   * refund charge carries the bank receipt from the seller and its fee, and an unrelated misc
   * expense crediting A with the refund of acquired receivables (not a depreciated asset). The
   * refund records themselves book the refunds, against the seller. The charge's own tax category
   * is the clearing account, which nothing credits.
   */
  const ACQUISITION = 'tax-category-acquisition';
  const BANK = 'tax-category-usd-bank';
  const FEES = 'tax-category-fees';
  const assets = [
    asset('software', '160000', 'category-software', ACQUISITION),
    asset('customer-relationships', '200000', 'category-customer-relationships', ACQUISITION),
  ];
  const refunds = [usdRefund('software', '16000'), usdRefund('customer-relationships', '20000')];
  const charge = { id: REFUND_CHARGE_ID, owner_id: OWNER_ID };
  // USD 40,980 received and USD 20 of fees for the USD 36,000 refunded and the USD 5,000 of
  // receivables
  const chargeEntries = [
    usdEntry(BANK, SELLER, 40_980),
    usdEntry(FEES, SELLER, 20),
    usdEntry(SELLER, ACQUISITION, 5000),
  ];

  beforeEach(() => {
    vi.mocked(getChargeTaxCategoryId).mockReset();
  });

  it('books the cost reductions against the seller, in USD, and the corrections', async () => {
    const ledger = await generateDepreciationDisposalsLedger(
      refunds,
      charge,
      makeInjector(assets, refunds),
      CLEARING,
      chargeEntries,
      SELLER,
    );

    expect(ledger.errors).toEqual([]);
    expect(rows(ledger.entries)).toEqual([
      [SELLER, ACQUISITION, 59_200],
      [AD, CORRECTION, 7172],
      [SELLER, ACQUISITION, 74_000],
      [AD, CORRECTION, 3396],
    ]);
    // the cost reductions take the refunded amounts themselves
    expect(costReductionsInUsd(ledger.entries)).toEqual([16_000, 20_000]);
    expect(ledger.entries.every(entry => entry.currency === Currency.Usd)).toBe(true);
    // nothing for the clearing account's checks: the seller's balance checks them
    expect(ledger.expectedProceeds).toBeNull();
    expect(ledger.proceedsDisposals).toEqual([]);
    expect(ledger.counterpartyRefunds).toEqual(refunds);
    // the seller balances in USD: USD 41,000 received, USD 41,000 refunded and repaid
    const seller = netCreditToAccount([...chargeEntries, ...ledger.entries], SELLER);
    expect(seller.foreign.get(Currency.Usd)).toBeCloseTo(0, 6);
  });

  it('books it by the record when the tax category is the asset account a misc expense credits', async () => {
    // the charge's tax category is A itself, which the unrelated misc expense credits in USD: not a
    // credit note, so the refunds are still booked against the seller
    const ledger = await generateDepreciationDisposalsLedger(
      refunds,
      charge,
      makeInjector(assets, refunds),
      ACQUISITION,
      chargeEntries,
      SELLER,
      [],
    );

    expect(ledger.errors).toEqual([]);
    expect(costReductions(ledger.entries)).toEqual([
      [SELLER, ACQUISITION, 59_200],
      [SELLER, ACQUISITION, 74_000],
    ]);
    expect(ledger.expectedProceeds).toBeNull();
    expect(ledger.counterpartyRefunds).toEqual(refunds);
  });

  it('books it by the record when only a misc expense credits the clearing account', async () => {
    // a USD misc expense crediting the clearing account is not a credit note either: only a
    // document (a credit invoice) to the tax category takes the refund from there
    const miscToClearing = [usdEntry(SELLER, CLEARING, 36_000), usdEntry(BANK, SELLER, 36_000)];

    const ledger = await generateDepreciationDisposalsLedger(
      refunds,
      charge,
      makeInjector(assets, refunds),
      CLEARING,
      miscToClearing,
      SELLER,
      [],
    );

    expect(ledger.errors).toEqual([]);
    expect(costReductions(ledger.entries)).toEqual([
      [SELLER, ACQUISITION, 59_200],
      [SELLER, ACQUISITION, 74_000],
    ]);
    expect(ledger.proceedsDisposals).toEqual([]);
    expect(ledger.counterpartyRefunds).toEqual(refunds);
  });

  it('reports a refund with neither a counterparty nor a credit note', async () => {
    const ledger = await generateDepreciationDisposalsLedger(
      refunds,
      charge,
      makeInjector(assets, refunds),
      CLEARING,
      chargeEntries,
      null,
    );

    expect(ledger.entries).toEqual([]);
    expect(ledger.errors).toEqual([
      'Asset cost refund refund-software: the refund charge has no counterparty, nor a credit note to its tax category, to take the refund from',
      'Asset cost refund refund-customer-relationships: the refund charge has no counterparty, nor a credit note to its tax category, to take the refund from',
    ]);
    expect(ledger.expectedProceeds).toBeNull();
  });

  it('keeps the credit note path when a document credits the tax category in the refund currency', async () => {
    // a USD credit-note document to the clearing account: as without the charge's entries, the
    // counterparty notwithstanding
    vi.mocked(getChargeTaxCategoryId).mockResolvedValue(null);
    const creditNote = [usdEntry(SELLER, CLEARING, 36_000), usdEntry(BANK, SELLER, 36_000)];

    const without = await generateDepreciationDisposalsLedger(
      refunds,
      charge,
      makeInjector(assets, refunds),
      CLEARING,
    );
    const withEntries = await generateDepreciationDisposalsLedger(
      refunds,
      charge,
      makeInjector(assets, refunds),
      CLEARING,
      creditNote,
      SELLER,
      // the credit note is a document (a credit invoice)
      creditNote.slice(0, 1),
    );

    expect(withEntries).toEqual({ ...without, counterpartyRefunds: [] });
    expect(costReductions(withEntries.entries)).toEqual([
      [CLEARING, ACQUISITION, 59_200],
      [CLEARING, ACQUISITION, 74_000],
    ]);
    expect(withEntries.expectedProceeds).toBe(133_200);
    expect(withEntries.proceedsDisposals).toEqual(refunds);
  });

  it('chooses per refund currency: a local credit note covers only the local refund', async () => {
    // laptops recorded in ILS, refunded ₪10,000 by an ILS credit note; the software's USD refund
    // has no USD credit note, so its record books it against the seller
    const laptops = {
      ...asset('laptops', '100000', 'category-software', 'tax-category-laptops'),
      currency: 'ILS' as const,
    };
    const laptopsRefund: IGetDepreciationDisposalsByIdsResult = {
      ...usdRefund('laptops', '0'),
      disposed_cost: '10000',
      original_amount: null,
      original_currency: null,
    };
    const softwareRefund = refunds[0];
    const events = [laptopsRefund, softwareRefund];
    const ilsCreditNote: LedgerProto = {
      ...usdEntry(SELLER, CLEARING, 0),
      currency: Currency.Ils,
      currencyRate: 1,
      debitAmount1: undefined,
      creditAmount1: undefined,
      localCurrencyDebitAmount1: 10_000,
      localCurrencyCreditAmount1: 10_000,
    };

    const ledger = await generateDepreciationDisposalsLedger(
      events,
      charge,
      makeInjector([laptops, assets[0]], events),
      CLEARING,
      [ilsCreditNote, usdEntry(BANK, SELLER, 16_000)],
      SELLER,
      [ilsCreditNote],
    );

    expect(ledger.errors).toEqual([]);
    expect(costReductions(ledger.entries)).toEqual([
      [CLEARING, 'tax-category-laptops', 10_000],
      [SELLER, ACQUISITION, 59_200],
    ]);
    expect(ledger.expectedProceeds).toBe(10_000);
    expect(ledger.proceedsDisposals).toEqual([laptopsRefund]);
    expect(ledger.counterpartyRefunds).toEqual([softwareRefund]);
  });

  it('chooses per refund currency: a USD credit note covers only the USD refund', async () => {
    // the software's USD refund comes with a USD credit note; the laptops' ILS refund has no ILS
    // credit note, so its record books it against the seller (the USD note's local value doesn't
    // count for it)
    const laptops = {
      ...asset('laptops', '100000', 'category-software', 'tax-category-laptops'),
      currency: 'ILS' as const,
    };
    const laptopsRefund: IGetDepreciationDisposalsByIdsResult = {
      ...usdRefund('laptops', '0'),
      disposed_cost: '10000',
      original_amount: null,
      original_currency: null,
    };
    const softwareRefund = refunds[0];
    const events = [softwareRefund, laptopsRefund];
    const usdCreditNote = usdEntry(SELLER, CLEARING, 16_000);
    const entries = [usdCreditNote, usdEntry(BANK, SELLER, 16_000)];
    const injector = makeInjector([assets[0], laptops], events);

    const ledger = await generateDepreciationDisposalsLedger(
      events,
      charge,
      injector,
      CLEARING,
      entries,
      SELLER,
      [usdCreditNote],
    );

    expect(ledger.errors).toEqual([]);
    expect(costReductions(ledger.entries)).toEqual([
      [CLEARING, ACQUISITION, 59_200],
      [SELLER, 'tax-category-laptops', 10_000],
    ]);
    expect(ledger.proceedsDisposals).toEqual([softwareRefund]);
    expect(ledger.counterpartyRefunds).toEqual([laptopsRefund]);

    // no mixed-events error: the USD refund is alone in the credit note's group
    const exchange = await generateCostRefundExchangeLedger({
      disposals: ledger.proceedsDisposals,
      proceedsAccountId: CLEARING,
      expectedProceeds: ledger.expectedProceeds!,
      charge,
      chargeEntries: entries,
      injector,
    });
    expect(exchange.errors).toEqual([]);
    // USD 16,000 credited at ₪3.650, moved out at ₪3.700
    expect(rows(exchange.entries)).toEqual([[EXCHANGE_RATES, CLEARING, 800]]);
  });

  it('checks a credit note to the asset account against the documents only', async () => {
    // the charge's tax category is A, credited by a USD credit invoice for exactly the software's
    // refund, and by the unrelated misc expense (refunded receivables)
    const softwareRefund = refunds[0];
    const creditNote = usdEntry(SELLER, ACQUISITION, 16_000);
    const entries = [creditNote, usdEntry(SELLER, ACQUISITION, 5000), usdEntry(BANK, SELLER, 21_000)];
    const injector = makeInjector([assets[0]], [softwareRefund]);

    const ledger = await generateDepreciationDisposalsLedger(
      [softwareRefund],
      charge,
      injector,
      ACQUISITION,
      entries,
      SELLER,
      [creditNote],
    );

    // the credit note reduced A: no cost-reduction row, only the correction
    expect(ledger.errors).toEqual([]);
    expect(rows(ledger.entries)).toEqual([[AD, CORRECTION, 7172]]);
    expect(ledger.proceedsDisposals).toEqual([softwareRefund]);
    expect(ledger.proceedsToAssetAccount).toBe(true);

    // checked against the documents, the misc expense left in A
    const exchange = await generateCostRefundExchangeLedger({
      disposals: ledger.proceedsDisposals,
      proceedsAccountId: ACQUISITION,
      expectedProceeds: ledger.expectedProceeds!,
      charge,
      chargeEntries: [creditNote],
      injector,
    });
    expect(exchange.errors).toEqual([]);
    // A ends reduced by the cost reduction at the cost-basis rate: ₪58,400 + ₪800
    expect(rows(exchange.entries)).toEqual([[EXCHANGE_RATES, ACQUISITION, 800]]);
  });

  it('keeps counting every entry for a clearing tax category', async () => {
    const softwareRefund = refunds[0];
    const creditNote = usdEntry(SELLER, CLEARING, 16_000);

    const ledger = await generateDepreciationDisposalsLedger(
      [softwareRefund],
      charge,
      makeInjector([assets[0]], [softwareRefund]),
      CLEARING,
      [creditNote],
      SELLER,
      [creditNote],
    );

    expect(ledger.proceedsToAssetAccount).toBe(false);
  });
});
