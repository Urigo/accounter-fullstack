import type { Injector } from 'graphql-modules';
import {
  endOfTimelessYear,
  getTimelessDateYear,
  timelessDateFromParts,
} from '../../../shared/helpers/index.js';
import { FinancialEntitiesProvider } from '../../financial-entities/providers/financial-entities.provider.js';
import type { IGetAllFinancialEntitiesResult } from '../../financial-entities/types.js';
import { LedgerProvider } from '../../ledger/providers/ledger.provider.js';
import type { IGetLedgerRecordsByDatesResult } from '../../ledger/types.js';
import { SortCodesProvider } from '../../sort-codes/providers/sort-codes.provider.js';
import type { IGetAllSortCodesResult } from '../../sort-codes/types.js';
import {
  decorateLedgerRecords,
  getProfitLossReportAmounts,
  type DecoratedLedgerRecord,
} from './profit-and-loss.helper.js';
import { calculateCumulativeRnDExpenses, calculateTaxAmounts } from './tax.helper.js';

export type ProfitLossReportAmounts = ReturnType<typeof getProfitLossReportAmounts>;
export type TaxAmounts = Awaited<ReturnType<typeof calculateTaxAmounts>>;

/** A business's books up to the end of a tax year, with the year's P&L and tax computation. */
export type AnnualTaxData = {
  year: number;
  /** The owner whose ledger was read: the only owner-scoped input (see `loadAnnualTaxData`). */
  ownerId: string;
  /** Every ledger record of the owner from the start of the books up to the end of `year`. */
  ledgerRecords: IGetLedgerRecordsByDatesResult[];
  /** `ledgerRecords` grouped by the year of their invoice date. */
  ledgerByYear: Map<number, IGetLedgerRecordsByDatesResult[]>;
  financialEntities: IGetAllFinancialEntitiesResult[];
  financialEntitiesById: Map<string, IGetAllFinancialEntitiesResult>;
  sortCodes: IGetAllSortCodesResult[];
  /** Decorated (sort-coded) ledger of `year` and the two years before it (R&D, section 20A). */
  decoratedLedgerByYear: Map<number, DecoratedLedgerRecord[]>;
  /** Decorated ledger of `year` alone. */
  decoratedLedgerRecords: DecoratedLedgerRecord[];
  /** P&L amounts (books) of `year`. */
  profitLoss: ProfitLossReportAmounts;
  /** P&L amounts of `year` and the two years before it. */
  profitLossByYear: Map<number, ProfitLossReportAmounts>;
  /** The year's R&D expenses, added back to profit for tax (positive). */
  researchAndDevelopmentAddBack: number;
  /** A third of the R&D expenses of `year` and the two years before it (section 20A). */
  taxableCumulativeResearchAndDevelopment: number;
  /** The tax report computation for `year` (annual workflow step 13). */
  taxAmounts: TaxAmounts;
};

/**
 * Loads a business's books up to the end of a tax year and runs the same P&L and tax computation
 * as the tax report. Shared by the annual reports built from those books (6111, 1214).
 *
 * Only the ledger query is scoped to `ownerId`. Financial entities and sort codes are read
 * unfiltered, and `calculateTaxAmounts` reads the session's admin context (tax categories) and the
 * year's business trips without an owner filter. The result is therefore only consistent for the
 * session's active owner: for any other `ownerId`, its ledger is combined with the active owner's
 * tax settings and the trips of every business in the session's scope.
 *
 * The 1214 report only calls this for the active owner. The 6111 report does not yet guard against
 * it: it accepts any business in the read scope, as it did before this function was extracted.
 * Making the result correct for any owner means passing `ownerId` on to `calculateTaxAmounts`
 * (`AdminContextProvider.adminContextByOwnerIdLoader`, business trips filtered by owner).
 *
 * The year is not validated here: callers must check it (e.g. 2000–2100) before calling.
 */
export async function loadAnnualTaxData(
  injector: Injector,
  ownerId: string,
  year: number,
): Promise<AnnualTaxData> {
  const fromDate = timelessDateFromParts(1990, 1, 1); // TODO: maybe take company init date as from date
  const toDate = endOfTimelessYear(year);
  const [ledgerRecords, financialEntities, sortCodes] = await Promise.all([
    // the report is per business: read that business's books, not the session's default owner
    injector.get(LedgerProvider).getLedgerRecordsByDates({ fromDate, toDate, ownerId }),
    injector.get(FinancialEntitiesProvider).getAllFinancialEntities(),
    injector.get(SortCodesProvider).getAllSortCodes(),
  ]);

  const financialEntitiesById = new Map<string, IGetAllFinancialEntitiesResult>(
    financialEntities.map(entity => [entity.id, entity]),
  );

  const ledgerByYear = new Map<number, IGetLedgerRecordsByDatesResult[]>();
  for (const record of ledgerRecords) {
    const recordYear = getTimelessDateYear(record.invoice_date);
    const yearRecords = ledgerByYear.get(recordYear) ?? [];
    yearRecords.push(record);
    ledgerByYear.set(recordYear, yearRecords);
  }

  // Tax adjustments use the same computation as the tax report (annual workflow step 13). R&D is
  // deducted over three years (section 20A), so it needs the two preceding years as well.
  const decoratedLedgerByYear = new Map<number, DecoratedLedgerRecord[]>();
  for (const rndYear of [year - 2, year - 1, year]) {
    decoratedLedgerByYear.set(
      rndYear,
      decorateLedgerRecords(ledgerByYear.get(rndYear) ?? [], financialEntitiesById),
    );
  }
  const decoratedLedgerRecords = decoratedLedgerByYear.get(year) ?? [];
  // Fill all three years here, rather than relying on `calculateCumulativeRnDExpenses` caching the
  // years it computes into the map it is given.
  const profitLoss = getProfitLossReportAmounts(decoratedLedgerRecords);
  const profitLossByYear = new Map<number, ProfitLossReportAmounts>();
  for (const [ledgerYear, decoratedRecords] of decoratedLedgerByYear) {
    profitLossByYear.set(
      ledgerYear,
      ledgerYear === year ? profitLoss : getProfitLossReportAmounts(decoratedRecords),
    );
  }
  const { profitBeforeTax, researchAndDevelopmentExpenses } = profitLoss;
  const researchAndDevelopmentAddBack = researchAndDevelopmentExpenses.amount * -1;
  const taxableCumulativeResearchAndDevelopment =
    calculateCumulativeRnDExpenses(year, decoratedLedgerByYear, profitLossByYear) / 3;
  const taxAmounts = await calculateTaxAmounts(
    injector,
    year,
    decoratedLedgerRecords,
    researchAndDevelopmentAddBack,
    taxableCumulativeResearchAndDevelopment,
    profitBeforeTax.amount,
  );

  return {
    year,
    ownerId,
    ledgerRecords,
    ledgerByYear,
    financialEntities,
    financialEntitiesById,
    sortCodes,
    decoratedLedgerByYear,
    decoratedLedgerRecords,
    profitLoss,
    profitLossByYear,
    researchAndDevelopmentAddBack,
    taxableCumulativeResearchAndDevelopment,
    taxAmounts,
  };
}
