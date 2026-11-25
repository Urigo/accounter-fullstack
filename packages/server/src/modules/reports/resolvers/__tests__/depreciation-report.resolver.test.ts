import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import { DepreciationCategoriesProvider } from '../../../depreciation/providers/depreciation-categories.provider.js';
import { DepreciationDisposalsProvider } from '../../../depreciation/providers/depreciation-disposals.provider.js';
import { DepreciationProvider } from '../../../depreciation/providers/depreciation.provider.js';
import type {
  IGetAllDepreciationCategoriesResult,
  IGetDepreciationDisposalsByIdsResult,
  IGetDepreciationRecordsByDatesResult,
} from '../../../depreciation/types.js';
import { depreciationReportResolvers } from '../depreciation-report.resolver.js';

vi.mock('../../../charges/helpers/common.helper.js', () => ({
  getChargeTransactionsMeta: vi.fn(async () => ({ transactionsMinDebitDate: null })),
}));

/*
 * The acquisition cost-refund case, in shekels (all names, IDs and amounts are fictional). Four
 * assets are activated on 2023-08-20 at the cost-basis rate of 3.700: software ₪592,000 at 33%,
 * customer relationships ₪740,000 at 12.5%, goodwill ₪222,000 at 10% and trademarks ₪148,000 in a
 * 0% category (not depreciated). On 2024-04-14 the supplier refunds part of the price, which
 * corrects each asset's cost from activation: software ₪59,200, customer relationships ₪74,000,
 * goodwill ₪222,000 (all of it) and trademarks ₪14,800.
 */

const OWNER_ID = 'owner-business';
const REFUND_CHARGE_ID = 'refund-charge';
const REFUND_DATE = '2024-04-14';

const categories: IGetAllDepreciationCategoriesResult[] = [
  { id: 'category-software', name: 'Software', percentage: '33' },
  { id: 'category-intangibles', name: 'Customer relationships', percentage: '12.5' },
  { id: 'category-goodwill', name: 'Goodwill', percentage: '10' },
  { id: 'category-trademarks', name: 'Trademarks', percentage: '0' },
];

function asset(id: string, category: string, amount: number): IGetDepreciationRecordsByDatesResult {
  const row: Omit<IGetDepreciationRecordsByDatesResult, 'local_amount'> = {
    id,
    activation_date: '2023-08-20',
    amount: String(amount),
    asset_tax_category_id: null,
    category,
    charge_id: 'acquisition-charge',
    currency: null,
    owner_id: OWNER_ID,
    type: id === 'software' ? 'RESEARCH_AND_DEVELOPMENT' : 'GENERAL_AND_MANAGEMENT',
  };
  return row as IGetDepreciationRecordsByDatesResult;
}

function costRefund(depreciationId: string, amount: number): IGetDepreciationDisposalsByIdsResult {
  return {
    id: `refund-${depreciationId}`,
    charge_id: REFUND_CHARGE_ID,
    created_at: new Date('2024-04-15T00:00:00.000Z'),
    depreciation_id: depreciationId,
    description: null,
    disposal_date: REFUND_DATE,
    disposed_cost: String(amount),
    original_amount: null,
    original_currency: null,
    owner_id: OWNER_ID,
    proceeds: '0',
    refund_mode: 'FROM_ACTIVATION',
    type: 'COST_REFUND',
    updated_at: new Date('2024-04-15T00:00:00.000Z'),
  } as IGetDepreciationDisposalsByIdsResult;
}

const records = [
  asset('software', 'category-software', 592_000),
  asset('customer-relationships', 'category-intangibles', 740_000),
  asset('goodwill', 'category-goodwill', 222_000),
  asset('trademarks', 'category-trademarks', 148_000),
];

const refundsByRecordId: Record<string, IGetDepreciationDisposalsByIdsResult[]> = {
  software: [costRefund('software', 59_200)],
  'customer-relationships': [costRefund('customer-relationships', 74_000)],
  goodwill: [costRefund('goodwill', 222_000)],
  trademarks: [costRefund('trademarks', 14_800)],
};

function makeInjector(assetRecords: IGetDepreciationRecordsByDatesResult[]) {
  const providers = new Map<unknown, unknown>([
    [AdminContextProvider, { getVerifiedAdminContext: async () => ({ ownerId: OWNER_ID }) }],
    [DepreciationProvider, { getDepreciationRecordsByDates: async () => assetRecords }],
    [DepreciationCategoriesProvider, { getAllDepreciationCategories: async () => categories }],
    [
      DepreciationDisposalsProvider,
      {
        getDisposalsByDepreciationIdLoader: {
          load: async (id: string) => refundsByRecordId[id] ?? [],
        },
      },
    ],
    [
      ChargesProvider,
      {
        getChargeByIdLoader: {
          load: async (id: string) => ({ id, user_description: 'Acquisition' }),
        },
      },
    ],
  ]);
  return { get: (token: unknown) => providers.get(token) } as unknown as Injector;
}

type ReportRecord = {
  id: string;
  originalCost: number;
  reportYearDelta: number;
  reportYearDisposedCost: number;
  reportYearRefundedCost: number;
  totalDepreciableCosts: number;
  pastYearsAccumulatedDepreciation: number;
  reportYearDepreciationCorrection: number;
  reportYearClaimedDepreciation: number;
  reportYearDisposedDepreciation: number;
  totalDepreciation: number;
  netValue: number;
  disposals: IGetDepreciationDisposalsByIdsResult[];
  costRefunds: IGetDepreciationDisposalsByIdsResult[];
};
type ReportResult = {
  categories: { category: { id: string }; records: ReportRecord[]; summary: ReportRecord }[];
  summary: ReportRecord;
};
type AnyResolver = (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown;

async function runReport(
  year: number,
  assetRecords: IGetDepreciationRecordsByDatesResult[] = records,
): Promise<ReportResult> {
  const resolver = (depreciationReportResolvers.Query as Record<string, AnyResolver>)
    .depreciationReport;
  return (await resolver(
    {},
    { filters: { year, financialEntityId: OWNER_ID } },
    { injector: makeInjector(assetRecords) },
    {},
  )) as ReportResult;
}

function recordById(report: ReportResult, id: string) {
  return report.categories.flatMap(category => category.records).find(record => record.id === id);
}

describe('depreciationReport with cost refunds', () => {
  it('shows the refund year as a cost reduction and a depreciation correction', async () => {
    const report = await runReport(2024);

    expect(recordById(report, 'software')).toMatchObject({
      originalCost: 592_000,
      reportYearDelta: 0,
      reportYearDisposedCost: 0,
      reportYearRefundedCost: 59_200,
      totalDepreciableCosts: 532_800,
      pastYearsAccumulatedDepreciation: 71_721,
      reportYearDepreciationCorrection: 7172,
      reportYearClaimedDepreciation: 175_824,
      reportYearDisposedDepreciation: 0,
      totalDepreciation: 240_373,
      netValue: 292_427,
    });
    expect(recordById(report, 'customer-relationships')).toMatchObject({
      originalCost: 740_000,
      reportYearRefundedCost: 74_000,
      totalDepreciableCosts: 666_000,
      pastYearsAccumulatedDepreciation: 33_959,
      reportYearDepreciationCorrection: 3396,
      reportYearClaimedDepreciation: 83_250,
      totalDepreciation: 113_813,
      netValue: 552_187,
    });
    expect(recordById(report, 'goodwill')).toMatchObject({
      originalCost: 222_000,
      reportYearRefundedCost: 222_000,
      totalDepreciableCosts: 0,
      pastYearsAccumulatedDepreciation: 8150,
      reportYearDepreciationCorrection: 8150,
      reportYearClaimedDepreciation: 0,
      totalDepreciation: 0,
      netValue: 0,
    });

    expect(report.summary).toMatchObject({
      originalCost: 1_554_000,
      reportYearRefundedCost: 355_200,
      totalDepreciableCosts: 1_198_800,
      pastYearsAccumulatedDepreciation: 113_830,
      reportYearDepreciationCorrection: 18_718,
      reportYearClaimedDepreciation: 259_074,
      totalDepreciation: 354_186,
      netValue: 844_614,
    });
  });

  it('lists refunds as cost refunds, not as disposals', async () => {
    const report = await runReport(2024);

    for (const id of ['software', 'customer-relationships', 'goodwill']) {
      const record = recordById(report, id);
      expect(record?.disposals).toEqual([]);
      expect(record?.costRefunds.map(refund => refund.id)).toEqual([`refund-${id}`]);
    }
    expect(report.summary.reportYearDisposedCost).toBe(0);
    expect(report.summary.reportYearDisposedDepreciation).toBe(0);
  });

  it('leaves assets in a 0% category out of the rows and the totals', async () => {
    for (const year of [2023, 2024]) {
      const report = await runReport(year);
      expect(report.categories.map(category => category.category.id)).not.toContain(
        'category-trademarks',
      );
      expect(recordById(report, 'trademarks')).toBeUndefined();
    }

    const report2023 = await runReport(2023);
    // the additions are the three depreciated assets only: 592,000 + 740,000 + 222,000
    expect(report2023.summary.reportYearDelta).toBe(1_554_000);
  });

  it('leaves an asset fully refunded in an earlier year off the later years', async () => {
    const report2024 = await runReport(2024);
    expect(recordById(report2024, 'goodwill')).toMatchObject({
      originalCost: 222_000,
      reportYearRefundedCost: 222_000,
      totalDepreciableCosts: 0,
      reportYearDepreciationCorrection: 8150,
      totalDepreciation: 0,
    });

    // the records query still returns it here, as it does for a foreign-currency asset whose
    // local cost is only known after conversion
    const report2025 = await runReport(2025);
    expect(recordById(report2025, 'goodwill')).toBeUndefined();
    const goodwill2025 = report2025.categories.find(
      category => category.category.id === 'category-goodwill',
    );
    expect(goodwill2025?.records).toEqual([]);
    expect(goodwill2025?.summary).toMatchObject({ originalCost: 0, totalDepreciableCosts: 0 });
    // software and customer relationships only, at their 2024 closing figures
    expect(report2025.summary).toMatchObject({
      originalCost: 1_198_800,
      reportYearRefundedCost: 0,
      pastYearsAccumulatedDepreciation: 354_186,
      reportYearDepreciationCorrection: 0,
    });
  });

  it('keeps an asset without an amount on the report as a row of zeros', async () => {
    const missingAmount = {
      ...asset('missing-amount', 'category-software', 0),
      amount: null,
    };

    for (const year of [2023, 2024, 2025]) {
      const report = await runReport(year, [...records, missingAmount]);
      expect(recordById(report, 'missing-amount')).toMatchObject({
        originalCost: 0,
        reportYearDelta: 0,
        totalDepreciableCosts: 0,
        reportYearClaimedDepreciation: 0,
        totalDepreciation: 0,
        netValue: 0,
        disposals: [],
        costRefunds: [],
      });
    }
  });

  it('leaves the year before the refund as filed', async () => {
    const report = await runReport(2023);

    expect(recordById(report, 'software')).toMatchObject({
      reportYearRefundedCost: 0,
      reportYearClaimedDepreciation: 71_721,
      costRefunds: [],
    });
    expect(recordById(report, 'customer-relationships')?.reportYearClaimedDepreciation).toBe(
      33_959,
    );
    expect(recordById(report, 'goodwill')?.reportYearClaimedDepreciation).toBe(8150);
    expect(report.summary.reportYearClaimedDepreciation).toBe(113_830);
    expect(report.summary.reportYearDepreciationCorrection).toBe(0);
  });
});
