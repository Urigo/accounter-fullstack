import { z } from 'zod';
import {
  SecuritiesIncomeKind,
  SecuritiesIncomeLocality,
  SecuritiesTaxCategoryKey,
  SemiAnnualAdvanceNote,
  YearHalf,
} from '../../../../gql/graphql.js';
import { formatStringifyAmount } from '../../../../helpers/index.js';

/** URL query parameter the report's filter is persisted under */
export const SECURITIES_SEMI_ANNUAL_PARAM = 'securitiesSemiAnnual';

export const MIN_REPORT_YEAR = 2000;

export type SemiAnnualFilter = {
  year: number;
  half: YearHalf;
  /** Capital losses carried forward from prior years, as of 1 January, in ILS */
  priorYearsLosses?: number;
  businessId?: string;
};

export const semiAnnualFilterSchema: z.ZodType<SemiAnnualFilter, SemiAnnualFilter> = z.object({
  year: z.number().int().min(MIN_REPORT_YEAR),
  half: z.enum(YearHalf),
  priorYearsLosses: z.number().nonnegative().optional(),
  businessId: z.uuid().optional(),
});

/**
 * The half to report by default: the latest that has ended — the first half from July on, the
 * previous year's second half until then.
 */
export function defaultSemiAnnualFilter(today: Date = new Date()): SemiAnnualFilter {
  const year = today.getFullYear();
  return today.getMonth() >= 6
    ? { year, half: YearHalf.H1 }
    : { year: year - 1, half: YearHalf.H2 };
}

/** The years the picker offers: from the current one back */
export function selectableYears(today: Date = new Date(), count = 8): number[] {
  const current = today.getFullYear();
  return Array.from({ length: count }, (_, index) => current - index).filter(
    year => year >= MIN_REPORT_YEAR,
  );
}

/** The PDF's default name: the browser names a printed page after its title */
export function semiAnnualFileName(year: number, half: YearHalf): string {
  return `securities-semi-annual-${year}-${half}`;
}

export const HALF_LABELS: Record<YearHalf, { he: string; en: string; months: string }> = {
  [YearHalf.H1]: { he: 'מחצית ראשונה', en: 'First half', months: 'Jan – Jun' },
  [YearHalf.H2]: { he: 'מחצית שנייה', en: 'Second half', months: 'Jul – Dec' },
};

export const INCOME_KIND_LABELS: Record<SecuritiesIncomeKind, { he: string; en: string }> = {
  [SecuritiesIncomeKind.Dividend]: { he: 'דיבידנד', en: 'Dividends' },
  [SecuritiesIncomeKind.Interest]: { he: 'ריבית', en: 'Interest' },
};

export const INCOME_LOCALITY_LABELS: Record<SecuritiesIncomeLocality, { he: string; en: string }> =
  {
    [SecuritiesIncomeLocality.Local]: { he: 'מקומי', en: 'Local' },
    [SecuritiesIncomeLocality.Foreign]: { he: 'זר', en: 'Foreign' },
  };

/** The securities expense tax categories in Hebrew; the English is the category's own name */
export const EXPENSE_CATEGORY_LABELS: Partial<Record<SecuritiesTaxCategoryKey, string>> = {
  [SecuritiesTaxCategoryKey.ForeignSecuritiesFees]: 'עמלות ניירות ערך',
  [SecuritiesTaxCategoryKey.FinancialConsultancy]: 'ייעוץ פיננסי',
};

/** What a note's wording needs from the report, in whole shekels */
export type AdvanceNoteFigures = {
  /** The half's net capital loss, as a positive amount */
  periodCapitalLoss: number;
  /** The half's own capital loss offset against its dividends and interest */
  capitalLossOffset: number;
  /** The first half's capital loss, carried into the second, offset against its income */
  firstHalfCapitalLossOffset: number;
  /** The tax before any credit; null when there is no tax rate */
  grossTax: number | null;
};

/** Keeps an amount left-to-right inside a Hebrew sentence */
const isolated = (amount: number) => `\u2066${formatWholeShekels(amount)}\u2069`;

/**
 * Why there is no advance, or a lower one, in the words the accountant sends. The carried-forward
 * sentence is hers verbatim; a capital loss is spelled out with its amount, and what it offset.
 */
export function advanceNoteText(
  note: SemiAnnualAdvanceNote,
  figures: AdvanceNoteFigures,
): { he: string; en: string } {
  switch (note) {
    case SemiAnnualAdvanceNote.CapitalGainsOffsetByCarriedForwardLosses:
      return {
        he: 'הרווחים קוזזו מול הפסדים מועברים ולכן אין חבות מס',
        en: 'The gains were offset against carried-forward losses, so there is no tax liability',
      };
    case SemiAnnualAdvanceNote.CapitalLossInPeriod: {
      const { periodCapitalLoss, capitalLossOffset, grossTax } = figures;
      // only when the losses left nothing to tax; a foreign tax credit has a note of its own
      const noLiability = grossTax === 0;
      return {
        he:
          `בתקופה נוצר הפסד הון ממכירת ניירות ערך בסך ${isolated(periodCapitalLoss)}` +
          (capitalLossOffset > 0
            ? `, שקוזז כנגד הכנסות הדיבידנד והריבית בסך ${isolated(capitalLossOffset)} (סעיף 92(א)(4))`
            : '') +
          (noLiability ? ', ולכן אין חבות מס' : ', ולכן אין חבות מס בגין המכירות'),
        en:
          `The sales of the period ended in a capital loss of ${formatWholeShekels(periodCapitalLoss)}` +
          (capitalLossOffset > 0
            ? `, offset against ${formatWholeShekels(capitalLossOffset)} of dividend and interest income (s.92(a)(4))`
            : '') +
          (noLiability
            ? ', so there is no tax liability'
            : ', so the sales carry no tax liability'),
      };
    }
    case SemiAnnualAdvanceNote.CapitalLossOffsetAgainstIncome:
      return {
        he: `הפסד הון מהמחצית הראשונה של השנה בסך ${isolated(figures.firstHalfCapitalLossOffset)} קוזז כנגד הכנסות הדיבידנד והריבית (סעיף 92(א)(4))`,
        en: `A capital loss of ${formatWholeShekels(figures.firstHalfCapitalLossOffset)} from the first half of the year was offset against the dividend and interest income (s.92(a)(4))`,
      };
    case SemiAnnualAdvanceNote.IncomeTaxCoveredByForeignTax:
      return {
        he: 'המס הזר ששולם על הדיבידנד והריבית מקוזז כנגד המס בישראל',
        en: 'The foreign tax paid on the dividends and interest is credited against the Israeli tax',
      };
    case SemiAnnualAdvanceNote.LiabilityCoveredByWithholding:
      return {
        he: 'המס שנוכה במקור מכסה את חבות המס ולכן אין מקדמה לתשלום',
        en: 'The tax withheld at source covers the liability, so there is no advance to pay',
      };
    case SemiAnnualAdvanceNote.NoTaxableEvents:
      return {
        he: 'לא היו בתקופה מכירות, דיבידנדים, ריבית או הוצאות',
        en: 'There were no sales, dividends, interest or expenses in the period',
      };
  }
}

/** `2026-06-30` → `30/6/2026`, as the accountant writes dates */
export function formatShortDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    return date;
  }
  return `${day}/${month}/${year}`;
}

/** Whole shekels with a true minus sign: `₪ 1,234`, `−₪ 56` */
export function formatWholeShekels(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = `₪ ${formatStringifyAmount(Math.abs(rounded), 0)}`;
  return rounded < 0 ? `−${formatted}` : formatted;
}

/** A shekel amount with agorot, for the appendices */
export function formatShekels(amount: number): string {
  const formatted = `₪ ${formatStringifyAmount(Math.abs(amount), 2)}`;
  return Number(amount.toFixed(2)) < 0 ? `−${formatted}` : formatted;
}

/** A tax rate fraction as a percentage: `0.23` → `23%` */
export function formatTaxRate(rate: number): string {
  return `${Number((rate * 100).toFixed(2))}%`;
}
