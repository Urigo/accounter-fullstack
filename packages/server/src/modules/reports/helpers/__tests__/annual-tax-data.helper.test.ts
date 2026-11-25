import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinancialEntitiesProvider } from '../../../financial-entities/providers/financial-entities.provider.js';
import type { IGetAllFinancialEntitiesResult } from '../../../financial-entities/types.js';
import { LedgerProvider } from '../../../ledger/providers/ledger.provider.js';
import type { IGetLedgerRecordsByDatesResult } from '../../../ledger/types.js';
import { SortCodesProvider } from '../../../sort-codes/providers/sort-codes.provider.js';
import type { IGetAllSortCodesResult } from '../../../sort-codes/types.js';
import { loadAnnualTaxData } from '../annual-tax-data.helper.js';
import { calculateTaxAmounts } from '../tax.helper.js';

vi.mock('../tax.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../tax.helper.js')>()),
  calculateTaxAmounts: vi.fn(async () => ({ taxableIncomeAmount: 1234 })),
}));

const OWNER_ID = 'owner';

function record(
  invoiceDate: string,
  debit: string,
  credit: string,
  amount: number,
): IGetLedgerRecordsByDatesResult {
  return {
    invoice_date: invoiceDate,
    debit_entity1: debit,
    debit_local_amount1: String(amount),
    credit_entity1: credit,
    credit_local_amount1: String(amount),
    debit_entity2: null,
    debit_local_amount2: null,
    credit_entity2: null,
    credit_local_amount2: null,
  } as unknown as IGetLedgerRecordsByDatesResult;
}

const FINANCIAL_ENTITIES = [
  { id: 'bank', sort_code: 100 },
  { id: 'revenue', sort_code: 800 },
  { id: 'rnd', sort_code: 920 },
] as unknown as IGetAllFinancialEntitiesResult[];

const SORT_CODES = [
  { key: 800, name: 'Revenue', owner_id: OWNER_ID },
] as unknown as IGetAllSortCodesResult[];

const LEDGER = [
  record('2022-06-30', 'rnd', 'bank', 999), // outside the three-year R&D window
  record('2023-06-30', 'rnd', 'bank', 300),
  record('2024-06-30', 'rnd', 'bank', 600),
  record('2025-03-31', 'bank', 'revenue', 5000),
  record('2025-06-30', 'rnd', 'bank', 900),
];

function fakeInjector(ledger: IGetLedgerRecordsByDatesResult[] = LEDGER) {
  const getLedgerRecordsByDates = vi.fn(async () => ledger);
  const providers = new Map<unknown, unknown>([
    [LedgerProvider, { getLedgerRecordsByDates }],
    [FinancialEntitiesProvider, { getAllFinancialEntities: async () => FINANCIAL_ENTITIES }],
    [SortCodesProvider, { getAllSortCodes: async () => SORT_CODES }],
  ]);
  const injector = { get: (token: unknown) => providers.get(token) } as unknown as Injector;
  return { injector, getLedgerRecordsByDates };
}

describe('loadAnnualTaxData', () => {
  beforeEach(() => {
    vi.mocked(calculateTaxAmounts).mockClear();
  });

  it("reads the owner's books up to the end of the year", async () => {
    const { injector, getLedgerRecordsByDates } = fakeInjector();
    const data = await loadAnnualTaxData(injector, OWNER_ID, 2025);

    expect(getLedgerRecordsByDates).toHaveBeenCalledWith({
      fromDate: '1990-01-01',
      toDate: '2025-12-31',
      ownerId: OWNER_ID,
    });
    expect(data.ledgerRecords).toBe(LEDGER);
    expect(data.financialEntities).toBe(FINANCIAL_ENTITIES);
    expect(data.financialEntitiesById.get('rnd')).toBe(FINANCIAL_ENTITIES[2]);
    expect(data.sortCodes).toBe(SORT_CODES);
    expect([...data.ledgerByYear.keys()]).toEqual([2022, 2023, 2024, 2025]);
    expect(data.ledgerByYear.get(2025)).toHaveLength(2);
  });

  it('computes the P&L of the year and R&D over the year and the two before it', async () => {
    const { injector } = fakeInjector();
    const data = await loadAnnualTaxData(injector, OWNER_ID, 2025);

    expect([...data.decoratedLedgerByYear.keys()]).toEqual([2023, 2024, 2025]);
    expect(data.decoratedLedgerRecords).toBe(data.decoratedLedgerByYear.get(2025));
    expect(data.decoratedLedgerRecords[0].credit_entity_sort_code1).toBe(800);
    expect(data.profitLoss.revenue.amount).toBe(5000);
    expect(data.profitLoss.profitBeforeTax.amount).toBe(4100);
    expect(data.profitLossByYear.get(2025)).toBe(data.profitLoss);
    expect(data.researchAndDevelopmentAddBack).toBe(900);
    expect(data.taxableCumulativeResearchAndDevelopment).toBe(-600);
  });

  it('handles an empty ledger: empty decorated years and no R&D', async () => {
    const { injector } = fakeInjector([]);
    const data = await loadAnnualTaxData(injector, OWNER_ID, 2025);

    expect(data.ledgerByYear.size).toBe(0);
    expect(data.ledgerByYear.has(2023)).toBe(false);
    expect(data.ledgerByYear.has(2024)).toBe(false);
    expect(data.decoratedLedgerByYear.get(2023)).toEqual([]);
    expect(data.decoratedLedgerByYear.get(2024)).toEqual([]);
    expect(data.decoratedLedgerRecords).toEqual([]);
    expect(data.profitLoss.profitBeforeTax.amount).toBeCloseTo(0);
    expect(data.researchAndDevelopmentAddBack).toBeCloseTo(0);
    expect(data.taxableCumulativeResearchAndDevelopment).toBeCloseTo(0);
  });

  it('buckets records on the last day of a year into that year', async () => {
    const lastDayOfYear = record('2025-12-31', 'rnd', 'bank', 30);
    const lastDayBeforeWindow = record('2022-12-31', 'rnd', 'bank', 60);
    const firstDayOfWindow = record('2023-01-01', 'rnd', 'bank', 90);
    const { injector } = fakeInjector([lastDayBeforeWindow, firstDayOfWindow, lastDayOfYear]);
    const data = await loadAnnualTaxData(injector, OWNER_ID, 2025);

    expect(data.ledgerByYear.get(2025)).toEqual([lastDayOfYear]);
    expect(data.ledgerByYear.get(2022)).toEqual([lastDayBeforeWindow]);
    expect(data.ledgerByYear.get(2023)).toEqual([firstDayOfWindow]);
    expect(data.decoratedLedgerByYear.has(2022)).toBe(false);
    expect(data.decoratedLedgerByYear.get(2023)).toHaveLength(1);
    expect(data.decoratedLedgerRecords).toHaveLength(1);
    expect(data.researchAndDevelopmentAddBack).toBe(30);
    // R&D of 2023 and 2025 only: the 2022-12-31 record is outside the three-year window
    expect(data.taxableCumulativeResearchAndDevelopment).toBe(-40);
  });

  it("hands the year's amounts to the tax report computation", async () => {
    const { injector } = fakeInjector();
    const data = await loadAnnualTaxData(injector, OWNER_ID, 2025);

    expect(calculateTaxAmounts).toHaveBeenCalledOnce();
    expect(calculateTaxAmounts).toHaveBeenCalledWith(
      injector,
      2025,
      data.decoratedLedgerRecords,
      900,
      -600,
      4100,
    );
    expect(data.taxAmounts).toEqual({ taxableIncomeAmount: 1234 });
  });
});
