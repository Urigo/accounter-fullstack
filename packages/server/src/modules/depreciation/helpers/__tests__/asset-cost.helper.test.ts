import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import {
  getChargeDocumentsMeta,
  getChargeTransactionsMeta,
} from '../../../charges/helpers/common.helper.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import { MiscExpensesProvider } from '../../../misc-expenses/providers/misc-expenses.provider.js';
import {
  convertForeignRefund,
  resolveAssetLocalCost,
  type AssetCostRecord,
} from '../asset-cost.helper.js';

vi.mock('../../../charges/helpers/common.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../charges/helpers/common.helper.js')>()),
  getChargeDocumentsMeta: vi.fn(),
  getChargeTransactionsMeta: vi.fn(),
}));

/*
 * All IDs, amounts, rates and dates below are made up.
 */

const CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';

/** Rates in shekels per dollar, by day */
const RATES: Record<TimelessDateString, number> = {
  '2025-01-10': 3.6,
  '2025-01-20': 3.7,
  '2025-02-01': 3.8,
  // the acquisition case: the contract date, the payment date and the refund date
  '2023-08-20': 3.7,
  '2023-08-27': 3.68,
  '2024-04-14': 3.65,
};

type MiscExpense = { invoice_date: TimelessDateString; value_date: Date };

function record(overrides: Partial<AssetCostRecord> = {}): AssetCostRecord {
  return {
    id: 'dd000000-0000-4000-8000-000000000001',
    charge_id: CHARGE_ID,
    amount: '1000',
    currency: 'USD',
    local_amount: null,
    activation_date: '2025-02-01',
    ...overrides,
  };
}

function buildInjector({ miscExpenses = [] }: { miscExpenses?: MiscExpense[] } = {}) {
  const getExchangeRates = vi.fn(async (base: string, quote: string, date: TimelessDateString) => {
    const rate = RATES[date];
    if (base !== 'USD' || quote !== 'ILS' || rate === undefined) {
      throw new Error(`no rate for ${base}/${quote} on ${date}`);
    }
    return rate;
  });
  const injector = {
    get: (token: unknown) => {
      if (token === AdminContextProvider) {
        return { getVerifiedAdminContext: async () => ({ defaultLocalCurrency: 'ILS' }) };
      }
      if (token === ExchangeProvider) {
        return { getExchangeRates };
      }
      if (token === MiscExpensesProvider) {
        return { getExpensesByChargeIdLoader: { load: async () => miscExpenses } };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
  return { injector, getExchangeRates };
}

function mockChargeDates({
  documentsMinDate = null,
  transactionsMinDebitDate = null,
}: {
  documentsMinDate?: TimelessDateString | null;
  transactionsMinDebitDate?: TimelessDateString | null;
}) {
  vi.mocked(getChargeDocumentsMeta).mockResolvedValue({ documentsMinDate } as never);
  vi.mocked(getChargeTransactionsMeta).mockResolvedValue({ transactionsMinDebitDate } as never);
}

describe('resolveAssetLocalCost', () => {
  beforeEach(() => {
    vi.mocked(getChargeDocumentsMeta).mockReset();
    vi.mocked(getChargeTransactionsMeta).mockReset();
  });

  it('takes the local cost override as is', async () => {
    const { injector, getExchangeRates } = buildInjector();

    await expect(
      resolveAssetLocalCost(injector, record({ local_amount: '3900' })),
    ).resolves.toEqual({ cost: 3900, rate: null, rateDate: null, source: 'OVERRIDE' });
    expect(getExchangeRates).not.toHaveBeenCalled();
  });

  it('takes a local-currency amount as is', async () => {
    const { injector, getExchangeRates } = buildInjector();

    await expect(
      resolveAssetLocalCost(injector, record({ amount: '12000', currency: 'ILS' })),
    ).resolves.toEqual({ cost: 12_000, rate: null, rateDate: null, source: 'LOCAL' });
    await expect(
      resolveAssetLocalCost(injector, record({ amount: '12000', currency: null })),
    ).resolves.toEqual({ cost: 12_000, rate: null, rateDate: null, source: 'LOCAL' });
    expect(getExchangeRates).not.toHaveBeenCalled();
  });

  it('converts a foreign-currency amount at the rate of the invoice date', async () => {
    mockChargeDates({ documentsMinDate: '2025-01-10', transactionsMinDebitDate: '2025-01-20' });
    const { injector } = buildInjector();

    const result = await resolveAssetLocalCost(injector, record());

    expect(result).toMatchObject({ rate: 3.6, rateDate: '2025-01-10', source: 'CONVERTED' });
    expect(result.cost).toBeCloseTo(3600);
    expect(getChargeDocumentsMeta).toHaveBeenCalledWith(CHARGE_ID, injector);
  });

  it('falls back to the first payment date when the charge has no documents', async () => {
    mockChargeDates({ transactionsMinDebitDate: '2025-01-20' });
    const { injector } = buildInjector();

    const result = await resolveAssetLocalCost(injector, record());

    expect(result).toMatchObject({ rate: 3.7, rateDate: '2025-01-20', source: 'CONVERTED' });
    expect(result.cost).toBeCloseTo(3700);
  });

  it('takes the contract date of an acquisition entered as misc expenses, not its payment date', async () => {
    // the purchase charge has no documents: its misc expenses are dated on the contract date
    // (₪3.700), its payment a week later (₪3.680)
    mockChargeDates({ transactionsMinDebitDate: '2023-08-27' });
    const { injector } = buildInjector({
      miscExpenses: [
        { invoice_date: '2023-08-20', value_date: new Date(2023, 7, 20) },
        { invoice_date: '2023-08-21', value_date: new Date(2023, 7, 21) },
      ],
    });

    const result = await resolveAssetLocalCost(
      injector,
      record({ amount: '160000', activation_date: '2023-08-20' }),
    );

    expect(result).toMatchObject({ rate: 3.7, rateDate: '2023-08-20', source: 'CONVERTED' });
    expect(result.cost).toBeCloseTo(592_000);
  });

  it('falls back to the activation date when the charge has neither documents nor payments', async () => {
    mockChargeDates({});
    const { injector } = buildInjector();

    const result = await resolveAssetLocalCost(injector, record());

    expect(result).toMatchObject({ rate: 3.8, rateDate: '2025-02-01', source: 'CONVERTED' });
    expect(result.cost).toBeCloseTo(3800);
  });

  it('has no cost when the record has no amount', async () => {
    const { injector, getExchangeRates } = buildInjector();

    await expect(resolveAssetLocalCost(injector, record({ amount: null }))).resolves.toEqual({
      cost: null,
      rate: null,
      rateDate: null,
      source: 'MISSING',
    });
    expect(getExchangeRates).not.toHaveBeenCalled();
  });

  it('asks for an override when there is no rate for the date', async () => {
    mockChargeDates({ documentsMinDate: '2025-03-01' });
    const { injector } = buildInjector();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(resolveAssetLocalCost(injector, record())).rejects.toThrow(
      'set its local cost instead',
    );
  });

  it('looks a record up once per operation', async () => {
    mockChargeDates({ documentsMinDate: '2025-01-10' });
    const { injector, getExchangeRates } = buildInjector();
    const asset = record();

    await Promise.all([
      resolveAssetLocalCost(injector, asset),
      resolveAssetLocalCost(injector, asset),
    ]);

    expect(getExchangeRates).toHaveBeenCalledTimes(1);
  });
});

describe('convertForeignRefund', () => {
  beforeEach(() => {
    vi.mocked(getChargeDocumentsMeta).mockReset();
    vi.mocked(getChargeTransactionsMeta).mockReset();
  });

  // the acquired assets, paid in USD and entered as misc expenses dated 2023-08-20 (₪3.700)
  const ACQUISITION = { documentsMinDate: null, transactionsMinDebitDate: '2023-08-27' } as const;
  const assets = {
    goodwill: record({ id: 'goodwill', amount: '60000', activation_date: '2023-08-20' }),
    software: record({ id: 'software', amount: '160000', activation_date: '2023-08-20' }),
    customers: record({ id: 'customers', amount: '200000', activation_date: '2023-08-20' }),
    trademarks: record({ id: 'trademarks', amount: '40000', activation_date: '2023-08-20' }),
  };
  const acquisitionExpenses: MiscExpense[] = [
    { invoice_date: '2023-08-20', value_date: new Date(2023, 7, 20) },
  ];

  it("converts refunds of the original price at the asset's cost-basis rate", async () => {
    mockChargeDates(ACQUISITION);
    const { injector } = buildInjector({ miscExpenses: acquisitionExpenses });
    const refund = (originalAmount: number) => ({
      originalAmount,
      refundMode: 'FROM_ACTIVATION' as const,
      chargeId: 'refund-charge',
      refundDate: '2024-04-14' as const,
    });

    // the supplier refunds USD 100,000 on 2024-04-14 (₪3.650), corrected at the 2023 rate ₪3.700
    const [goodwill, software, customers, trademarks] = await Promise.all([
      convertForeignRefund(injector, assets.goodwill, refund(60_000)),
      convertForeignRefund(injector, assets.software, refund(16_000)),
      convertForeignRefund(injector, assets.customers, refund(20_000)),
      convertForeignRefund(injector, assets.trademarks, refund(4000)),
    ]);

    expect([goodwill.cost, software.cost, customers.cost, trademarks.cost]).toEqual([
      222_000, 59_200, 74_000, 14_800,
    ]);
    expect(software.rate).toBeCloseTo(3.7);
    expect(software.rateDate).toBe('2023-08-20');
  });

  it("carries a local cost override through the asset's cost-basis rate", async () => {
    const { injector, getExchangeRates } = buildInjector();

    // a ₪600,000 cost for USD 160,000 is ₪3.75 a dollar
    const result = await convertForeignRefund(
      injector,
      record({ amount: '160000', local_amount: '600000' }),
      { originalAmount: 16_000, refundMode: 'FROM_ACTIVATION', refundDate: '2024-04-14' },
    );

    expect(result).toEqual({ cost: 60_000, rate: 3.75, rateDate: null });
    expect(getExchangeRates).not.toHaveBeenCalled();
  });

  it("converts a later rebate at the refund charge's rate", async () => {
    mockChargeDates({ documentsMinDate: '2024-04-14' });
    const { injector } = buildInjector();

    const result = await convertForeignRefund(injector, assets.software, {
      originalAmount: 16_000,
      refundMode: 'FROM_REFUND_DATE',
      chargeId: 'refund-charge',
      refundDate: '2024-04-20',
    });

    expect(result).toEqual({ cost: 58_400, rate: 3.65, rateDate: '2024-04-14' });
    expect(getChargeDocumentsMeta).toHaveBeenCalledWith('refund-charge', injector);
  });

  it('rejects a refund of an asset without an amount', async () => {
    const { injector } = buildInjector();

    await expect(
      convertForeignRefund(injector, record({ amount: null }), {
        originalAmount: 100,
        refundMode: 'FROM_ACTIVATION',
        refundDate: '2024-04-14',
      }),
    ).rejects.toThrow('has no amount to convert its cost refunds by');
  });
});
