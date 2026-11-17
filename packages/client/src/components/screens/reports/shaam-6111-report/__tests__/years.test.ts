import { describe, expect, it } from 'vitest';
import { getShaam6111AvailableYears } from '../years.js';

describe('getShaam6111AvailableYears', () => {
  it('offers every closed tax year, latest first', () => {
    // closing 2025 during 2026
    const years = getShaam6111AvailableYears(2026);
    expect(years[0]).toBe('2025');
    expect(years.at(-1)).toBe('2020');
    expect(years).not.toContain('2026');
  });

  it('adds a new year once the previous one ends', () => {
    expect(getShaam6111AvailableYears(2027)[0]).toBe('2026');
  });

  it('keeps a year selected through the URL listed', () => {
    expect(getShaam6111AvailableYears(2026, '2026')).toEqual([
      '2026',
      '2025',
      '2024',
      '2023',
      '2022',
      '2021',
      '2020',
    ]);
    expect(getShaam6111AvailableYears(2026, '2025')).toHaveLength(6);
  });
});
