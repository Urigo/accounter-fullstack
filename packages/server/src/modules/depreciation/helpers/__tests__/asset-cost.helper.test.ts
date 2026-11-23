import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import type { TimelessDateString } from '../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import {
  getChargeDocumentsMeta,
  getChargeTransactionsMeta,
} from '../../../charges/helpers/common.helper.js';
import { ExchangeProvider } from '../../../exchange-rates/providers/exchange.provider.js';
import { resolveAssetLocalCost, type AssetCostRecord } from '../asset-cost.helper.js';

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
};

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

function buildInjector() {
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
