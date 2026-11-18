import type { Injector } from 'graphql-modules';
import { describe, expect, it } from 'vitest';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { BusinessTripsProvider } from '../../../business-trips/providers/business-trips.provider.js';
import { CorporateTaxesProvider } from '../../../corporate-taxes/providers/corporate-taxes.provider.js';
import { TaxCategoriesProvider } from '../../../financial-entities/providers/tax-categories.provider.js';
import { DecoratedLedgerRecord, getProfitLossReportAmounts } from '../profit-and-loss.helper.js';
import {
  calculateCumulativeRnDExpenses,
  calculateTaxAmounts,
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

/** Taxable income of `year`, computed the way the tax report, the tax charge and 6111 do */
async function taxableIncome(
  ledgerByYear: Map<number, DecoratedLedgerRecord[]>,
  year = YEAR,
  taxExcludedCategoryIds: string[] = [],
) {
  const records = ledgerByYear.get(year) ?? [];
  const { profitBeforeTax, researchAndDevelopmentExpenses } = getProfitLossReportAmounts(records);
  const taxAmounts = await calculateTaxAmounts(
    fakeInjector(taxExcludedCategoryIds),
    year,
    records,
    researchAndDevelopmentForTax(researchAndDevelopmentExpenses).amount * -1,
    calculateCumulativeRnDExpenses(year, ledgerByYear) / 3,
    profitBeforeTax.amount,
  );
  return { profitBeforeTax: profitBeforeTax.amount, ...taxAmounts };
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
    expect(researchAndDevelopmentForTax(researchAndDevelopmentExpenses).amount).toBe(-600);
    expect(calculateCumulativeRnDExpenses(YEAR, ledgerByYear)).toBe(-600);

    const { profitBeforeTax, reserves, researchAndDevelopmentExpensesForTax, taxableIncomeAmount } =
      await taxableIncome(ledgerByYear);
    expect(profitBeforeTax).toBe(100);
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
});
