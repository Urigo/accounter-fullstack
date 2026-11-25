import type { GraphQLResolveInfo } from 'graphql';
import type { Pool, PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ACCOUNTS,
  ACQUISITION_DATE,
  acquisitionCostRefundFixture,
  ASSETS,
  BUSINESSES,
  BUYER_ID,
  CATEGORIES,
  CHARGES,
  costRefundsFixture,
  insertBuyer,
  insertBuyerAdminContext,
  PAYMENT_DATE,
  REFUND_DATE,
  REFUND_USD,
  REFUNDS,
} from '../../../__tests__/fixtures/depreciation/acquisition-cost-refund.js';
import { buildAdminContextFromDb } from '../../../__tests__/helpers/admin-context-builder.js';
import { TestDatabase } from '../../../__tests__/helpers/db-setup.js';
import { insertFixture } from '../../../__tests__/helpers/fixture-loader.js';
import { qualifyTable } from '../../../__tests__/helpers/test-db-config.js';
import { transactionScopedPool } from '../../../__tests__/helpers/test-transaction.js';
import type { LedgerRecordsProto } from '../../../shared/types/index.js';
import { createLedgerTestContext } from '../../../test-utils/ledger-injector.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import {
  checkDisposal,
  computeStoredDisposal,
  loadAssetContext,
  loadDisposalLocalCost,
} from '../../depreciation/helpers/depreciation-disposals.helper.js';
import { DepreciationDisposalsProvider } from '../../depreciation/providers/depreciation-disposals.provider.js';
import { depreciationReportResolvers } from '../../reports/resolvers/depreciation-report.resolver.js';
import { ledgerGenerationByCharge } from '../helpers/ledger-by-charge-type.helper.js';
import type { IGetLedgerRecordsByChargesIdsResult } from '../types.js';

/*
 * The acquisition cost-refund case, end to end (docs/annual-audit-workflow/depreciation/
 * acquisition-cost-refund-test-spec.md, §3-§6). The scenario's charges, assets and money are
 * inserted, the ledger of each charge is generated through the ledger generators, the cost refunds
 * are entered on the refund charge, and the depreciation report is read through its resolver. All
 * of it runs in one test transaction, rolled back at the end.
 *
 * Depreciation is in whole shekels per asset per year; amounts converted from USD (the ledger's
 * document, transaction, misc-expense and exchange-rate rows) are in agorot.
 */

type ReportRecord = {
  id: string;
  originalCost: number | null;
  reportYearDelta: number | null;
  reportYearRefundedCost: number | null;
  totalDepreciableCosts: number;
  pastYearsAccumulatedDepreciation: number;
  reportYearDepreciationCorrection: number | null;
  reportYearClaimedDepreciation: number;
  totalDepreciation: number;
  netValue: number;
  costRefunds: Array<{ id: string }>;
  disposals: Array<{ id: string }>;
};
type Report = {
  categories: Array<{ category: { id: string }; records: Array<Record<string, unknown>> }>;
};
type AnyResolver = (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown;

/** A ledger row, by account name: Dr `dr` / Cr `cr`, in ILS (and in USD when converted) */
type Row = {
  dr: string | null;
  cr: string | null;
  ils: number;
  usd: number | null;
  invoiceDate: string;
  valueDate: string;
};

const ACCOUNT_NAMES = new Map<string, string>(
  [...Object.entries(ACCOUNTS), ...Object.entries(BUSINESSES)].map(([name, id]) => [id, name]),
);
const accountName = (id: string | null) => (id ? (ACCOUNT_NAMES.get(id) ?? id) : null);
const agorot = (value: string | number | null | undefined) =>
  value == null ? null : Math.round(Number(value) * 100) / 100;

/** The ledger records as rows, with the amounts each side books (they must match) */
function toRows(records: readonly IGetLedgerRecordsByChargesIdsResult[]): Row[] {
  return records.map(record => {
    expect(record.debit_entity2 ?? record.credit_entity2).toBeNull();
    const debit = agorot(record.debit_local_amount1);
    const credit = agorot(record.credit_local_amount1);
    if (record.debit_entity1 && record.credit_entity1) {
      expect(debit).toBe(credit);
    }
    return {
      dr: accountName(record.debit_entity1),
      cr: accountName(record.credit_entity1),
      ils: (record.debit_entity1 ? debit : credit) ?? 0,
      usd: agorot(record.debit_foreign_amount1 ?? record.credit_foreign_amount1),
      invoiceDate: record.invoice_date,
      valueDate: record.value_date,
    };
  });
}

const rowKey = (row: Row) => `${row.dr}|${row.cr}|${row.ils}|${row.usd}|${row.invoiceDate}`;
const sortRows = (rows: Row[]) => [...rows].sort((a, b) => rowKey(a).localeCompare(rowKey(b)));
const row = (
  dr: string | null,
  cr: string | null,
  ils: number,
  date: string,
  usd: number | null = null,
): Row => ({ dr, cr, ils, usd, invoiceDate: date, valueDate: date });

/** Debits minus credits per account (positive: a debit balance), in agorot */
function balances(rows: readonly Row[]): Map<string, number> {
  const result = new Map<string, number>();
  const add = (account: string | null, amount: number) => {
    if (account) {
      result.set(account, agorot((result.get(account) ?? 0) + amount)!);
    }
  };
  for (const { dr, cr, ils } of rows) {
    add(dr, ils);
    add(cr, -ils);
  }
  return result;
}

const year = (date: string) => date.slice(0, 4);

describe('Acquisition cost refund, end to end (spec §3-§6)', () => {
  let db: TestDatabase;
  let client: PoolClient;
  let pool: Pool;

  const newContext = () =>
    createLedgerTestContext({ pool, moduleId: 'ledger', businessId: BUYER_ID });

  /** Generates (and stores, unless stored before) the ledger of a charge */
  async function generateLedger(chargeId: string): Promise<LedgerRecordsProto> {
    const context = newContext();
    const charge = await context.injector.get(ChargesProvider).getChargeByIdLoader.load(chargeId);
    if (!charge) {
      throw new Error(`Charge ${chargeId} not found`);
    }
    const result = await ledgerGenerationByCharge(
      charge,
      { insertLedgerRecordsIfNotExists: true },
      context as unknown as GraphQLModules.ModuleContext,
      {} as GraphQLResolveInfo,
    );
    if (!result || 'message' in result) {
      throw new Error(`Ledger generation failed for charge ${chargeId}: ${result?.message}`);
    }
    return result as LedgerRecordsProto;
  }

  /** The depreciation report as the API returns it (its field resolvers round the amounts) */
  async function depreciationReport(reportYear: number) {
    const resolver = (depreciationReportResolvers.Query as Record<string, AnyResolver>)
      .depreciationReport;
    const report = (await resolver(
      {},
      { filters: { year: reportYear } },
      newContext(),
      {},
    )) as Report;
    const fieldResolvers = depreciationReportResolvers.DepreciationReportRecord as Record<
      string,
      (record: unknown) => unknown
    >;
    const scenarioAssets = new Set<string>(Object.values(ASSETS));
    const records = report.categories
      .flatMap(category => category.records)
      .filter(record => scenarioAssets.has(record['id'] as string))
      .map(
        record =>
          Object.fromEntries(
            Object.entries(record).map(([key, value]) => [
              key,
              fieldResolvers[key] ? fieldResolvers[key](record) : value,
            ]),
          ) as unknown as ReportRecord,
      );
    return {
      categoryIds: report.categories.map(category => category.category.id),
      records: new Map(records.map(record => [record.id, record])),
    };
  }

  async function storedLedgerRows(chargeIds: string[]): Promise<Row[]> {
    const { rows } = await client.query<IGetLedgerRecordsByChargesIdsResult>(
      `SELECT * FROM ${qualifyTable('ledger_records')} WHERE charge_id = ANY($1::uuid[])`,
      [chargeIds],
    );
    return toRows(rows);
  }

  // what the scenario produces, step by step
  let acquisitionLedger: LedgerRecordsProto;
  const before = {} as {
    depreciation2023: LedgerRecordsProto;
    report2023: Awaited<ReturnType<typeof depreciationReport>>;
  };
  let refundPreviews: Map<string, Awaited<ReturnType<typeof checkDisposal>>>;
  const after = {} as {
    depreciation2023: LedgerRecordsProto;
    refund: LedgerRecordsProto;
    depreciation2024: LedgerRecordsProto;
    report2023: Awaited<ReturnType<typeof depreciationReport>>;
    report2024: Awaited<ReturnType<typeof depreciationReport>>;
    report2025: Awaited<ReturnType<typeof depreciationReport>>;
  };

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
    await db.ensureLatestSchema();
    await db.seedAdmin();

    client = await db.getPool().connect();
    await client.query('BEGIN');
    pool = transactionScopedPool(client);

    const { ownerId: seededAdminId } = await buildAdminContextFromDb(client);
    await insertBuyer(client);
    await insertFixture(client, acquisitionCostRefundFixture, BUYER_ID);
    await insertBuyerAdminContext(client, seededAdminId);

    // 2023: the acquisition, its payment and the year's depreciation, filed before the refund
    acquisitionLedger = await generateLedger(CHARGES.acquisition);
    before.depreciation2023 = await generateLedger(CHARGES.depreciation2023);
    before.report2023 = await depreciationReport(2023);

    // 2024: the cost refunds, previewed as the API validates them, then entered on the refund charge
    const previewContext = newContext();
    refundPreviews = new Map();
    for (const [name, refundId] of Object.entries(REFUNDS) as Array<
      [keyof typeof REFUNDS, string]
    >) {
      const assetContext = await loadAssetContext(previewContext.injector, ASSETS[name]);
      refundPreviews.set(
        refundId,
        await checkDisposal(previewContext.injector, assetContext, {
          type: 'COST_REFUND',
          refundMode: 'FROM_ACTIVATION',
          chargeId: CHARGES.refund,
          disposalDate: REFUND_DATE,
          originalAmount: REFUND_USD[name],
        }),
      );
    }
    await insertFixture(client, costRefundsFixture, BUYER_ID);

    after.depreciation2023 = await generateLedger(CHARGES.depreciation2023);
    after.refund = await generateLedger(CHARGES.refund);
    after.depreciation2024 = await generateLedger(CHARGES.depreciation2024);
    after.report2023 = await depreciationReport(2023);
    after.report2024 = await depreciationReport(2024);
    after.report2025 = await depreciationReport(2025);
  }, 120_000);

  afterAll(async () => {
    // Roll the whole scenario back. The shared pool is managed by the vitest global setup.
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  describe('1. refund allocation and conversion (§3.1)', () => {
    const expected = {
      [REFUNDS.goodwill]: { costReduction: 222_000, remainingCost: 0 },
      [REFUNDS.software]: { costReduction: 59_200, remainingCost: 532_800 },
      [REFUNDS.customerRelationships]: { costReduction: 74_000, remainingCost: 666_000 },
      [REFUNDS.trademarks]: { costReduction: 14_800, remainingCost: 133_200 },
    };

    it('converts each USD refund at the cost-basis rate 3.700, leaving the corrected cost', () => {
      for (const [refundId, { costReduction, remainingCost }] of Object.entries(expected)) {
        const preview = refundPreviews.get(refundId);
        expect(preview?.errors).toBeUndefined();
        expect(preview?.exchangeRate).toBeCloseTo(3.7, 10);
        expect(preview?.result?.costReduction).toBe(costReduction);
        expect(preview?.remainingCost).toBe(remainingCost);
        // stored as costRefundsFixture inserts it: in USD, with no local cost (converted when read)
        const inserted = costRefundsFixture.depreciationDisposals!.disposals.find(
          disposal => disposal.id === refundId,
        );
        expect(preview?.stored).toEqual({
          disposedCost: null,
          originalAmount: Number(inserted?.originalAmount),
          originalCurrency: inserted?.originalCurrency,
        });
      }
      const total = Object.values(expected).reduce(
        (sum, { costReduction }) => sum + costReduction,
        0,
      );
      expect(total).toBe(370_000);
    });

    it('reads the stored refunds back at the same local cost', async () => {
      const injector = newContext().injector;
      const stored = await injector
        .get(DepreciationDisposalsProvider)
        .getDisposalsByChargeIdLoader.load(CHARGES.refund);
      expect(stored.map(disposal => disposal.id).sort()).toEqual(Object.keys(expected).sort());
      for (const disposal of stored) {
        expect(disposal).toMatchObject({
          type: 'COST_REFUND',
          refund_mode: 'FROM_ACTIVATION',
          disposal_date: REFUND_DATE,
          disposed_cost: null,
          original_currency: 'USD',
        });
        const { cost, rate } = await loadDisposalLocalCost(injector, disposal);
        expect(cost).toBe(expected[disposal.id].costReduction);
        expect(rate).toBeCloseTo(3.7, 10);
      }
    });
  });

  describe('2. 2023 stays as filed (§3.2)', () => {
    const filed2023 = [
      row('rndDepreciation', null, 71_721, '2023-12-31'),
      row('gnaDepreciation', null, 42_109, '2023-12-31'),
      row(null, 'accumulatedDepreciation', 113_830, '2023-12-31'),
    ];

    it('books R&D 71,721 and G&A 42,109 of depreciation, before and after the refunds', () => {
      for (const ledger of [before.depreciation2023, after.depreciation2023]) {
        expect(ledger.errors).toEqual([]);
        expect(sortRows(toRows(ledger.records))).toEqual(sortRows(filed2023));
      }
    });

    it('reports the same 2023 rows before and after the refunds', () => {
      const asFiled = {
        [ASSETS.software]: 71_721,
        [ASSETS.customerRelationships]: 33_959,
        [ASSETS.goodwill]: 8150,
      };
      for (const report of [before.report2023, after.report2023]) {
        expect([...report.records.keys()].sort()).toEqual(Object.keys(asFiled).sort());
        for (const [assetId, depreciation] of Object.entries(asFiled)) {
          expect(report.records.get(assetId)).toMatchObject({
            reportYearClaimedDepreciation: depreciation,
            reportYearRefundedCost: null,
            reportYearDepreciationCorrection: null,
            costRefunds: [],
          });
        }
      }
      expect(after.report2023.records).toEqual(before.report2023.records);
    });
  });

  describe('3. recapture and 2024 depreciation (§3.3, §3.4)', () => {
    it('recaptures 7,172 / 3,396 / 8,150 = 18,718 of 2023 depreciation', async () => {
      const injector = newContext().injector;
      const stored = await injector
        .get(DepreciationDisposalsProvider)
        .getDisposalsByChargeIdLoader.load(CHARGES.refund);
      const corrections = Object.fromEntries(
        await Promise.all(
          stored.map(
            async disposal =>
              [
                disposal.id,
                (await computeStoredDisposal(injector, disposal)).depreciationCorrection,
              ] as const,
          ),
        ),
      );
      expect(corrections).toEqual({
        [REFUNDS.software]: 7172,
        [REFUNDS.customerRelationships]: 3396,
        [REFUNDS.goodwill]: 8150,
        [REFUNDS.trademarks]: 0,
      });
    });

    it('depreciates the corrected cost in 2024: R&D 175,824, G&A 83,250, no goodwill', () => {
      expect(after.depreciation2024.errors).toEqual([]);
      expect(sortRows(toRows(after.depreciation2024.records))).toEqual(
        sortRows([
          row('rndDepreciation', null, 175_824, '2024-12-31'),
          // customer relationships only: goodwill has no cost left
          row('gnaDepreciation', null, 83_250, '2024-12-31'),
          row(null, 'accumulatedDepreciation', 259_074, '2024-12-31'),
        ]),
      );
    });

    it('reports 2024 as a cost reduction and a depreciation correction', () => {
      const report = after.report2024;
      expect(report.records.get(ASSETS.software)).toMatchObject({
        originalCost: 592_000,
        reportYearRefundedCost: 59_200,
        totalDepreciableCosts: 532_800,
        pastYearsAccumulatedDepreciation: 71_721,
        reportYearDepreciationCorrection: 7172,
        reportYearClaimedDepreciation: 175_824,
        totalDepreciation: 240_373,
        netValue: 292_427,
        costRefunds: [expect.objectContaining({ id: REFUNDS.software })],
        disposals: [],
      });
      expect(report.records.get(ASSETS.customerRelationships)).toMatchObject({
        originalCost: 740_000,
        reportYearRefundedCost: 74_000,
        totalDepreciableCosts: 666_000,
        pastYearsAccumulatedDepreciation: 33_959,
        reportYearDepreciationCorrection: 3396,
        reportYearClaimedDepreciation: 83_250,
        totalDepreciation: 113_813,
        netValue: 552_187,
        costRefunds: [expect.objectContaining({ id: REFUNDS.customerRelationships })],
        disposals: [],
      });
      expect(report.records.get(ASSETS.goodwill)).toMatchObject({
        originalCost: 222_000,
        reportYearRefundedCost: 222_000,
        totalDepreciableCosts: 0,
        pastYearsAccumulatedDepreciation: 8150,
        reportYearDepreciationCorrection: 8150,
        reportYearClaimedDepreciation: 0,
        totalDepreciation: 0,
        netValue: 0,
        costRefunds: [expect.objectContaining({ id: REFUNDS.goodwill })],
        disposals: [],
      });
    });
  });

  describe('4. ledger records per charge (§4)', () => {
    it('acquisition and payment: the allocation at 3.700, the payment at 3.680, an FX gain', () => {
      expect(acquisitionLedger.errors).toEqual([]);
      expect(acquisitionLedger.balance?.isBalanced).toBe(true);
      expect(sortRows(toRows(acquisitionLedger.records))).toEqual(
        sortRows([
          row('software', 'seller', 592_000, ACQUISITION_DATE, 160_000),
          row('customerRelationships', 'seller', 740_000, ACQUISITION_DATE, 200_000),
          row('goodwill', 'seller', 222_000, ACQUISITION_DATE, 60_000),
          row('trademarks', 'seller', 148_000, ACQUISITION_DATE, 40_000),
          row('acquiredReceivables', 'seller', 74_000, ACQUISITION_DATE, 20_000),
          row('seller', 'assumedLiabilities', 148_000, ACQUISITION_DATE, 40_000),
          row('seller', 'bankUsd', 1_619_200, PAYMENT_DATE, 440_000),
          row('seller', 'exchangeRates', 8800, PAYMENT_DATE),
        ]),
      );
    });

    it('refund: the credit note, receipt and fee at 3.650, the cost reductions at 3.700, the FX loss and the recapture', () => {
      expect(after.refund.errors).toEqual([]);
      expect(after.refund.balance?.isBalanced).toBe(true);
      expect(sortRows(toRows(after.refund.records))).toEqual(
        sortRows([
          row('refundSupplier', 'refundClearing', 365_000, REFUND_DATE, 100_000),
          row('bankUsd', 'refundSupplier', 364_927, REFUND_DATE, 99_980),
          row('fees', 'refundSupplier', 73, REFUND_DATE, 20),
          row('refundClearing', 'goodwill', 222_000, REFUND_DATE),
          row('refundClearing', 'software', 59_200, REFUND_DATE),
          row('refundClearing', 'customerRelationships', 74_000, REFUND_DATE),
          row('refundClearing', 'trademarks', 14_800, REFUND_DATE),
          row('exchangeRates', 'refundClearing', 5000, REFUND_DATE),
          row('accumulatedDepreciation', 'depreciationCorrection', 7172, REFUND_DATE),
          row('accumulatedDepreciation', 'depreciationCorrection', 3396, REFUND_DATE),
          row('accumulatedDepreciation', 'depreciationCorrection', 8150, REFUND_DATE),
        ]),
      );
      // dated in 2024, the recapture says which year's depreciation it corrects
      const corrections = after.refund.records.filter(
        record => record.credit_entity1 === ACCOUNTS.depreciationCorrection,
      );
      expect(corrections).toHaveLength(3);
      for (const correction of corrections) {
        expect(correction.description).toMatch(/: depreciation correction for 2023$/);
      }
    });

    it('balances every charge', async () => {
      for (const chargeId of Object.values(CHARGES)) {
        const rows = await storedLedgerRows([chargeId]);
        expect(rows.length).toBeGreaterThan(0);
        const sum = rows.reduce(
          (total, { dr, cr, ils }) => total + (dr ? ils : 0) - (cr ? ils : 0),
          0,
        );
        expect(agorot(sum)).toBe(0);
      }
    });
  });

  describe('5. balances at 2024-12-31 (§5)', () => {
    it('match the expected trial balance, 1,783,977 on each side', async () => {
      const rows = await storedLedgerRows(Object.values(CHARGES));
      expect(rows.every(({ valueDate }) => valueDate <= '2024-12-31')).toBe(true);

      // balance-sheet accounts accumulate; profit-and-loss accounts are shown per year
      const profitAndLoss = new Set([
        'rndDepreciation',
        'gnaDepreciation',
        'depreciationCorrection',
        'exchangeRates',
        'fees',
      ]);
      const lines = balances(
        rows.flatMap(entry => {
          const suffix = (account: string | null) =>
            account && profitAndLoss.has(account) ? `${account} ${year(entry.valueDate)}` : account;
          return [{ ...entry, dr: suffix(entry.dr), cr: suffix(entry.cr) }];
        }),
      );

      expect(Object.fromEntries([...lines].filter(([, balance]) => balance !== 0))).toEqual({
        software: 532_800,
        customerRelationships: 666_000,
        trademarks: 133_200,
        acquiredReceivables: 74_000,
        accumulatedDepreciation: -354_186,
        assumedLiabilities: -148_000,
        bankUsd: -1_254_273,
        'exchangeRates 2023': -8800,
        'exchangeRates 2024': 5000,
        'fees 2024': 73,
        'rndDepreciation 2023': 71_721,
        'gnaDepreciation 2023': 42_109,
        'rndDepreciation 2024': 175_824,
        'gnaDepreciation 2024': 83_250,
        'depreciationCorrection 2024': -18_718,
      });
      for (const account of ['goodwill', 'seller', 'refundSupplier', 'refundClearing']) {
        expect(lines.get(account) ?? 0).toBe(0);
      }

      const debits = [...lines.values()].filter(balance => balance > 0);
      const credits = [...lines.values()].filter(balance => balance < 0);
      expect(agorot(debits.reduce((sum, balance) => sum + balance, 0))).toBe(1_783_977);
      expect(agorot(credits.reduce((sum, balance) => sum - balance, 0))).toBe(1_783_977);

      // profit and loss: 2023 -105,030; 2024 -245,429
      const profit = (y: string) =>
        -[...lines]
          .filter(([account]) => account.endsWith(` ${y}`))
          .reduce((sum, [, balance]) => sum + balance, 0);
      expect(agorot(profit('2023'))).toBe(-105_030);
      expect(agorot(profit('2024'))).toBe(-245_429);
    });
  });

  describe('6. what the depreciation report leaves out (§6.6)', () => {
    it('never shows trademarks (0%) or acquired receivables (not an asset record)', () => {
      for (const report of [before.report2023, after.report2023, after.report2024]) {
        expect(report.categoryIds).not.toContain(CATEGORIES.notDepreciated);
        expect([...report.records.keys()].sort()).toEqual(
          [ASSETS.software, ASSETS.customerRelationships, ASSETS.goodwill].sort(),
        );
      }
    });

    it('leaves goodwill out of 2025, once its cost is refunded', () => {
      expect([...after.report2025.records.keys()].sort()).toEqual(
        [ASSETS.software, ASSETS.customerRelationships].sort(),
      );
    });
  });
});
