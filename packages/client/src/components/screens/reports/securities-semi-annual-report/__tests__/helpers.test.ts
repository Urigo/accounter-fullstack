import { describe, expect, it } from 'vitest';
import { SemiAnnualAdvanceNote, YearHalf } from '../../../../../gql/graphql.js';
import {
  ADVANCE_NOTE_TEXT,
  defaultSemiAnnualFilter,
  formatShekels,
  formatShortDate,
  formatTaxRate,
  formatWholeShekels,
  selectableYears,
  semiAnnualFileName,
  semiAnnualFilterSchema,
} from '../helpers.js';

describe('defaultSemiAnnualFilter', () => {
  it("is the year's first half once it has ended", () => {
    expect(defaultSemiAnnualFilter(new Date(2026, 9, 26))).toEqual({
      year: 2026,
      half: YearHalf.H1,
    });
    expect(defaultSemiAnnualFilter(new Date(2026, 6, 1))).toEqual({
      year: 2026,
      half: YearHalf.H1,
    });
  });

  it("is the previous year's second half until then", () => {
    expect(defaultSemiAnnualFilter(new Date(2027, 0, 15))).toEqual({
      year: 2026,
      half: YearHalf.H2,
    });
    expect(defaultSemiAnnualFilter(new Date(2027, 5, 30))).toEqual({
      year: 2026,
      half: YearHalf.H2,
    });
  });
});

describe('selectableYears', () => {
  it('counts back from the current year', () => {
    expect(selectableYears(new Date(2026, 9, 26), 3)).toEqual([2026, 2025, 2024]);
  });
});

describe('semiAnnualFileName', () => {
  it('names the PDF after the year and the half', () => {
    expect(semiAnnualFileName(2026, YearHalf.H1)).toBe('securities-semi-annual-2026-H1');
  });
});

describe('semiAnnualFilterSchema', () => {
  it('accepts a year and a half, with optional losses and company', () => {
    expect(
      semiAnnualFilterSchema.safeParse({
        year: 2026,
        half: YearHalf.H2,
        priorYearsLosses: 1500,
        businessId: '00000000-0000-4000-8000-000000000000',
      }).success,
    ).toBe(true);
    expect(semiAnnualFilterSchema.safeParse({ year: 2026, half: YearHalf.H1 }).success).toBe(true);
  });

  it('rejects negative losses, an unknown half and a year before 2000', () => {
    expect(
      semiAnnualFilterSchema.safeParse({ year: 2026, half: YearHalf.H1, priorYearsLosses: -1 })
        .success,
    ).toBe(false);
    expect(semiAnnualFilterSchema.safeParse({ year: 2026, half: 'H3' }).success).toBe(false);
    expect(semiAnnualFilterSchema.safeParse({ year: 1999, half: YearHalf.H1 }).success).toBe(false);
  });
});

describe('ADVANCE_NOTE_TEXT', () => {
  it('words every note in Hebrew and English', () => {
    for (const note of Object.values(SemiAnnualAdvanceNote)) {
      expect(ADVANCE_NOTE_TEXT[note].he).toBeTruthy();
      expect(ADVANCE_NOTE_TEXT[note].en).toBeTruthy();
    }
  });

  it("uses the accountant's own sentence for carried-forward losses", () => {
    expect(ADVANCE_NOTE_TEXT[SemiAnnualAdvanceNote.CapitalGainsOffsetByCarriedForwardLosses].he).toBe(
      'הרווחים קוזזו מול הפסדים מועברים ולכן אין חבות מס',
    );
  });
});

describe('formatting', () => {
  it('writes dates as the accountant does', () => {
    expect(formatShortDate('2026-06-30')).toBe('30/6/2026');
    expect(formatShortDate('2026-01-01')).toBe('1/1/2026');
  });

  it('writes whole shekels with a true minus sign', () => {
    expect(formatWholeShekels(1234567)).toBe('₪ 1,234,567');
    expect(formatWholeShekels(-56)).toBe('−₪ 56');
    expect(formatWholeShekels(-0.4)).toBe('₪ 0');
  });

  it('writes shekels with agorot', () => {
    expect(formatShekels(1234.5)).toBe('₪ 1,234.50');
    expect(formatShekels(-0.001)).toBe('₪ 0.00');
  });

  it('writes a tax rate as a percentage', () => {
    expect(formatTaxRate(0.23)).toBe('23%');
    expect(formatTaxRate(0.075)).toBe('7.5%');
  });
});
