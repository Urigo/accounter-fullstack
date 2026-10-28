import { z } from 'zod';
import {
  SecuritiesIncomeKind,
  SecuritiesIncomeLocality,
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

/**
 * Why there is no advance, or a lower one, in the words the accountant sends. The carried-forward
 * sentence is hers verbatim.
 */
export const ADVANCE_NOTE_TEXT: Record<SemiAnnualAdvanceNote, { he: string; en: string }> = {
  [SemiAnnualAdvanceNote.CapitalGainsOffsetByCarriedForwardLosses]: {
    he: 'הרווחים קוזזו מול הפסדים מועברים ולכן אין חבות מס',
    en: 'The gains were offset against carried-forward losses, so there is no tax liability',
  },
  [SemiAnnualAdvanceNote.CapitalLossInPeriod]: {
    he: 'בתקופה נוצר הפסד הון ממכירת ניירות ערך ולכן אין חבות מס בגינה',
    en: 'The sales of the period ended in a capital loss, so they carry no tax liability',
  },
  [SemiAnnualAdvanceNote.IncomeTaxCoveredByForeignTax]: {
    he: 'המס הזר ששולם על הדיבידנד והריבית מקוזז כנגד המס בישראל',
    en: 'The foreign tax paid on the dividends and interest is credited against the Israeli tax',
  },
  [SemiAnnualAdvanceNote.LiabilityCoveredByWithholding]: {
    he: 'המס שנוכה במקור מכסה את חבות המס ולכן אין מקדמה לתשלום',
    en: 'The tax withheld at source covers the liability, so there is no advance to pay',
  },
  [SemiAnnualAdvanceNote.NoTaxableEvents]: {
    he: 'לא היו בתקופה מכירות, דיבידנדים או ריבית',
    en: 'There were no sales, dividends or interest in the period',
  },
};

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
