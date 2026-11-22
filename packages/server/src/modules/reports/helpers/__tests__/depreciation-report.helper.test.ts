import { describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { DepreciationCategoriesProvider } from '../../../depreciation/providers/depreciation-categories.provider.js';
import { DepreciationDisposalsProvider } from '../../../depreciation/providers/depreciation-disposals.provider.js';
import { DepreciationProvider } from '../../../depreciation/providers/depreciation.provider.js';
import type {
  IGetDepreciationDisposalsByIdsResult,
  IGetDepreciationRecordsByIdsResult,
} from '../../../depreciation/types.js';
import { calculateDepreciationAmount } from '../depreciation-report.helper.js';

/*
 * All IDs, amounts and dates below are made up.
 *
 * The asset: ₪10,000 at 25%, activated on 2020-01-01, so ₪2,500 a year. Its stored expiration date,
 * 2022-06-30, comes before the natural end (2023-12-31): 2022 is its final year, which takes the
 * whole remaining value.
 */

const OWNER_ID = 'owner-business';
const OTHER_OWNER_ID = 'other-business';
const CATEGORY_ID = 'category-computers';

function record(
  overrides: Partial<IGetDepreciationRecordsByIdsResult> & { id: string },
): IGetDepreciationRecordsByIdsResult {
  return {
    activation_date: '2020-01-01',
    amount: '10000',
    category: CATEGORY_ID,
    charge_id: `charge-${overrides.id}`,
    currency: null,
    expiration_date: '2022-06-30',
    owner_id: OWNER_ID,
    type: 'GENERAL_AND_MANAGEMENT',
    ...overrides,
  } as IGetDepreciationRecordsByIdsResult;
}

function writeOff(
  overrides: Partial<IGetDepreciationDisposalsByIdsResult> & { id: string },
): IGetDepreciationDisposalsByIdsResult {
  return {
    charge_id: null,
    created_at: new Date('2022-04-01T00:00:00.000Z'),
    depreciation_id: 'asset',
    description: null,
    disposal_date: '2022-03-31',
    disposed_cost: '4000',
    owner_id: OWNER_ID,
    proceeds: '0',
    type: 'WRITE_OFF',
    updated_at: new Date('2022-04-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeInjector(
  records: IGetDepreciationRecordsByIdsResult[],
  disposalsByRecordId: Record<string, IGetDepreciationDisposalsByIdsResult[]> = {},
) {
  const loadCategory = vi.fn(async (_id: string) => ({ id: CATEGORY_ID, percentage: '25' }));
  const providers = new Map<unknown, unknown>([
    [DepreciationProvider, { getDepreciationRecordsByDates: async () => records }],
    [DepreciationCategoriesProvider, { getDepreciationCategoriesByIdLoader: { load: loadCategory } }],
    [
      DepreciationDisposalsProvider,
      {
        getDisposalsByDepreciationIdLoader: {
          load: async (id: string) => disposalsByRecordId[id] ?? [],
        },
      },
    ],
  ]);
  const injector = { get: (token: unknown) => providers.get(token) } as unknown as Injector;
  return { injector, loadCategory };
}

describe('calculateDepreciationAmount', () => {
  it('takes the whole remaining value in the year of the stored expiration date', async () => {
    const { injector } = makeInjector([record({ id: 'asset' })]);

    // 2020 and 2021 took ₪2,500 each, so 2022 takes the remaining ₪5,000
    await expect(calculateDepreciationAmount(injector, 2022, OWNER_ID)).resolves.toEqual({
      rndDepreciationYearlyAmount: 0,
      gnmDepreciationYearlyAmount: 5000,
      marketingDepreciationYearlyAmount: 0,
      totalDepreciationYearlyAmount: 5000,
    });
  });

  it('pro-rates the year to a disposal before the expiration date', async () => {
    const { injector } = makeInjector([record({ id: 'asset' })], {
      asset: [writeOff({ id: 'write-off' })],
    });

    // to 2022-03-31: round(2,500 × 90 / 365) = ₪616 on the whole asset. The ₪4,000 slice then
    // leaves with round(5,616 × 0.4) = ₪2,246 of the accumulated depreciation, and the remaining
    // ₪6,000 takes its whole remaining value, 6,000 − 3,370 = ₪2,630: ₪3,246 in all
    await expect(calculateDepreciationAmount(injector, 2022, OWNER_ID)).resolves.toEqual({
      rndDepreciationYearlyAmount: 0,
      gnmDepreciationYearlyAmount: 3246,
      marketingDepreciationYearlyAmount: 0,
      totalDepreciationYearlyAmount: 3246,
    });
  });

  it("leaves out other owners' assets", async () => {
    const { injector, loadCategory } = makeInjector([
      record({ id: 'asset' }),
      record({ id: 'others-asset', owner_id: OTHER_OWNER_ID, type: 'MARKETING' }),
    ]);

    await expect(calculateDepreciationAmount(injector, 2022, OWNER_ID)).resolves.toEqual({
      rndDepreciationYearlyAmount: 0,
      gnmDepreciationYearlyAmount: 5000,
      marketingDepreciationYearlyAmount: 0,
      totalDepreciationYearlyAmount: 5000,
    });
    expect(loadCategory).toHaveBeenCalledTimes(1);
  });
});
