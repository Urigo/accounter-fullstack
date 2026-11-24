import { describe, expect, it } from 'vitest';
import type { IGetShaam6111SettingsUpToYearResult } from '../../types.js';
import { effectiveShaam6111Settings } from '../shaam6111-settings.provider.js';

type SettingsRow = Pick<
  IGetShaam6111SettingsUpToYearResult,
  'year' | 'header' | 'tax_adjustment_overrides'
>;

describe('effectiveShaam6111Settings', () => {
  const rows: SettingsRow[] = [
    {
      year: 2023,
      header: { industryCode: '6201', businessType: 'SERVICE', auditOpinionType: 'QUALIFIED' },
      tax_adjustment_overrides: { '480': 100 },
    },
    {
      year: 2025,
      header: { businessDescription: 'פיתוח תוכנה', businessType: 'INDUSTRIAL' },
      tax_adjustment_overrides: { '160': 15 },
    },
  ];

  it("takes each header field from the latest year up to the report's year", () => {
    const { header } = effectiveShaam6111Settings(rows, 2026);
    expect(header).toEqual({
      industryCode: '6201',
      businessDescription: 'פיתוח תוכנה',
      businessType: 'INDUSTRIAL',
    });
  });

  it('never carries the audit opinion over from an earlier year', () => {
    expect(effectiveShaam6111Settings(rows, 2023).header.auditOpinionType).toBe('QUALIFIED');
    expect(effectiveShaam6111Settings(rows, 2024).header.auditOpinionType).toBeUndefined();
  });

  it("uses only the year's own manual amounts", () => {
    expect(effectiveShaam6111Settings(rows, 2025).taxAdjustmentOverrides).toEqual({ '160': 15 });
    expect(effectiveShaam6111Settings(rows, 2024).taxAdjustmentOverrides).toEqual({});
  });
});
