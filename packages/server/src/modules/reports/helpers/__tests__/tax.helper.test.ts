import type { Injector } from 'graphql-modules';
import { describe, expect, it } from 'vitest';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { BusinessTripsProvider } from '../../../business-trips/providers/business-trips.provider.js';
import { CorporateTaxesProvider } from '../../../corporate-taxes/providers/corporate-taxes.provider.js';
import { TaxCategoriesProvider } from '../../../financial-entities/providers/tax-categories.provider.js';
import { DecoratedLedgerRecord, getProfitLossReportAmounts } from '../profit-and-loss.helper.js';
import {
  calculateCumulativeRnDExpenses,
  calculateYearTax,
  computeCurrentTax,
  researchAndDevelopmentForTax,
} from '../tax.helper.js';

const YEAR = 2025;
const BANK_SORT_CODE = 100;

let recordId = 0;
/** A ledger record debiting `debit` and crediting `credit`, each with its sort code */
function entry(
  debit: [entityId: string, sortCode: number],
  credit: [entityId: string, sortCode: number],
  amount: number,
): DecoratedLedgerRecord {
  return {
    id: `record-${++recordId}`,
    debit_entity1: debit[0],
    debit_entity_sort_code1: debit[1],
    debit_local_amount1: String(amount),
    credit_entity1: credit[0],
    credit_entity_sort_code1: credit[1],
    credit_local_amount1: String(amount),
    debit_entity2: null,
    debit_local_amount2: null,
    credit_entity2: null,
    credit_local_amount2: null,
  } as unknown as DecoratedLedgerRecord;
}

const BANK: [string, number] = ['bank', BANK_SORT_CODE];
const revenue = (amount: number) => entry(BANK, ['revenue', 800], amount);
const rnd = (amount: number) => entry(['rnd-salaries', 930], BANK, amount);
const reserve = (amount: number, entityId = 'vacation-reserve') =>
  entry([entityId, 931], BANK, amount);

function fakeInjector(taxExcludedCategoryIds: string[] = []) {
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: async () => ({
          general: {
            taxCategories: {
              fineTaxCategoryId: 'fines',
              untaxableGiftsTaxCategoryId: 'gifts',
              salaryExcessExpensesTaxCategoryId: 'salary-excess',
            },
          },
        }),
      },
    ],
    [
      CorporateTaxesProvider,
      {
        getCorporateTaxesByDateLoader: {
          load: async () => ({ tax_rate: '23', original_tax_rate: '23' }),
        },
      },
    ],
    [BusinessTripsProvider, { getBusinessTripsByDates: async () => [] }],
    [
      TaxCategoriesProvider,
      {
        getAllTaxCategories: async () =>
          taxExcludedCategoryIds.map(id => ({ id, tax_excluded: true })),
      },
    ],
  ]);
  return { get: (token: unknown) => providers.get(token) } as unknown as Injector;
}

/** The tax computation of `year`, as the tax report, the tax charge and 6111 run it */
async function taxableIncome(
  ledgerByYear: Map<number, DecoratedLedgerRecord[]>,
  year = YEAR,
  taxExcludedCategoryIds: string[] = [],
) {
  const result = await calculateYearTax(fakeInjector(taxExcludedCategoryIds), year, ledgerByYear);
  return { ...result, profitBeforeTax: result.profitAndLoss.profitBeforeTax.amount };
}

describe('reserves (sort code 931) in the tax computation', () => {
  it('adds a reserve expense back exactly once, in its year', async () => {
    const ledgerByYear = new Map([[YEAR, [revenue(1000), reserve(300)]]]);

    const { profitBeforeTax, reserves, researchAndDevelopmentExpensesForTax, taxableIncomeAmount } =
      await taxableIncome(ledgerByYear);

    expect(profitBeforeTax).toBe(700);
    expect(reserves.amount).toBe(300);
    expect(researchAndDevelopmentExpensesForTax).toBe(0);
    expect(taxableIncomeAmount).toBe(1000);
  });

  it('keeps a reserve out of the section 20A spread of the following years', async () => {
    const ledgerByYear = new Map([
      [YEAR, [reserve(300)]],
      [YEAR + 1, []],
      [YEAR + 2, []],
    ]);

    for (const year of [YEAR, YEAR + 1, YEAR + 2]) {
      expect(calculateCumulativeRnDExpenses(year, ledgerByYear)).toBe(0);
    }
    expect((await taxableIncome(ledgerByYear, YEAR + 1)).taxableIncomeAmount).toBe(0);
    expect((await taxableIncome(ledgerByYear, YEAR + 2)).taxableIncomeAmount).toBe(0);
  });

  it('spreads only the non-reserve R&D (930) and still presents both in the P&L', async () => {
    const ledgerByYear = new Map([[YEAR, [revenue(1000), rnd(600), reserve(300)]]]);

    const { researchAndDevelopmentExpenses } = getProfitLossReportAmounts(ledgerByYear.get(YEAR)!);
    expect(researchAndDevelopmentExpenses.amount).toBe(-900);
    expect(researchAndDevelopmentForTax(researchAndDevelopmentExpenses, YEAR).amount).toBe(-600);
    expect(calculateCumulativeRnDExpenses(YEAR, ledgerByYear)).toBe(-600);

    const {
      profitBeforeTax,
      reserves,
      researchAndDevelopment,
      researchAndDevelopmentAddBack,
      researchAndDevelopmentExpensesForTax,
      taxableIncomeAmount,
    } = await taxableIncome(ledgerByYear);
    expect(profitBeforeTax).toBe(100);
    expect(researchAndDevelopment.records.map(record => record.sortCode)).toEqual([930]);
    expect(researchAndDevelopmentAddBack).toBe(600);
    expect(reserves.amount).toBe(300);
    expect(researchAndDevelopmentExpensesForTax).toBe(-200);
    // 100 profit + 600 R&D add-back + 300 reserves − 200 (a third of the R&D)
    expect(taxableIncomeAmount).toBe(800);
  });

  it('does not add back a reserve in a tax-excluded category', async () => {
    const ledgerByYear = new Map([[YEAR, [revenue(1000), reserve(300, 'excluded-reserve')]]]);

    const { reserves, researchAndDevelopmentExpensesForTax, taxableIncomeAmount } =
      await taxableIncome(ledgerByYear, YEAR, ['excluded-reserve']);

    expect(reserves.amount).toBe(0);
    expect(researchAndDevelopmentExpensesForTax).toBe(0);
    expect(taxableIncomeAmount).toBe(700);
  });

  it('keeps reserves of years before the 2025 cutover in R&D, as filed', async () => {
    const ledgerByYear = new Map([
      [2023, [reserve(300)]],
      [2024, [reserve(600)]],
      [2025, [revenue(1000), reserve(900)]],
    ]);

    const rnd2024 = getProfitLossReportAmounts(ledgerByYear.get(2024)!).researchAndDevelopmentExpenses;
    expect(researchAndDevelopmentForTax(rnd2024, 2024).amount).toBe(-600);
    // 2023 and 2024 still spread into 2025; 2025's own reserve does not
    expect(calculateCumulativeRnDExpenses(2025, ledgerByYear)).toBe(-900);

    const { researchAndDevelopmentAddBack, reserves, taxableIncomeAmount } =
      await taxableIncome(ledgerByYear, 2025);
    expect(researchAndDevelopmentAddBack).toBeCloseTo(0);
    expect(reserves.amount).toBe(900);
    // 100 profit + 900 reserves − 300 (a third of the 2023 and 2024 reserves)
    expect(taxableIncomeAmount).toBe(700);
  });
});

const rates = { taxRate: 0.12, specialTaxRate: 0.23 };

describe('computeCurrentTax', () => {
  it('books no tax in a loss year and reports the taxable loss', () => {
    const result = computeCurrentTax({
      ...rates,
      taxableIncomeAmount: -1_000_000,
      specialTaxableIncomeAmount: 0,
    });
    expect(result.annualTaxExpenseAmount).toBeCloseTo(-120_000);
    expect(result.currentTaxExpense).toBe(0);
    expect(result.taxableLoss).toBe(1_000_000);
    expect(result.mixedRateLoss).toBe(false);
  });

  it('books no tax and no loss when taxable income is exactly zero', () => {
    const result = computeCurrentTax({
      ...rates,
      taxableIncomeAmount: 0,
      specialTaxableIncomeAmount: 0,
    });
    expect(result.currentTaxExpense).toBe(0);
    expect(result.taxableLoss).toBe(0);
    expect(result.mixedRateLoss).toBe(false);
  });

  it('keeps profit-year amounts unchanged', () => {
    const result = computeCurrentTax({
      ...rates,
      taxableIncomeAmount: 1_000_000,
      specialTaxableIncomeAmount: 100_000,
    });
    expect(result.annualTaxExpenseAmount).toBeCloseTo(143_000);
    expect(result.currentTaxExpense).toBeCloseTo(143_000);
    expect(result.taxableLoss).toBe(0);
    expect(result.mixedRateLoss).toBe(false);
  });

  it('flags a preferred-rate loss with a sort-991 profit', () => {
    const result = computeCurrentTax({
      ...rates,
      taxableIncomeAmount: -500_000,
      specialTaxableIncomeAmount: 100_000,
    });
    expect(result.mixedRateLoss).toBe(true);
    expect(result.currentTaxExpense).toBe(0);
    expect(result.taxableLoss).toBe(400_000);
  });

  it('flags a preferred-rate profit with a sort-991 loss', () => {
    const result = computeCurrentTax({
      ...rates,
      taxableIncomeAmount: 500_000,
      specialTaxableIncomeAmount: -100_000,
    });
    expect(result.mixedRateLoss).toBe(true);
    expect(result.currentTaxExpense).toBeCloseTo(37_000);
    expect(result.taxableLoss).toBe(0);
  });
});
