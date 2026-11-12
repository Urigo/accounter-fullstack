import { describe, expect, it } from 'vitest';
import { normalizeAllocationNumber } from './allocation-number.helper.js';

describe('normalizeAllocationNumber', () => {
  it('takes the last 9 digits of a long Tax Authorities Code', () => {
    expect(normalizeAllocationNumber('20250101120000111123456789')).toBe('123456789');
    expect(normalizeAllocationNumber('20250202093000222987654321')).toBe('987654321');
  });

  it('ignores labels and separators around the digits', () => {
    expect(normalizeAllocationNumber('Tax Authorities Code - 20250101120000111123456789')).toBe(
      '123456789',
    );
    expect(normalizeAllocationNumber('123-456-789')).toBe('123456789');
    expect(normalizeAllocationNumber(' 123 456 789 ')).toBe('123456789');
  });

  it('keeps a plain 9-digit allocation number as is', () => {
    expect(normalizeAllocationNumber('123456789')).toBe('123456789');
  });

  it('returns null when there are fewer than 9 digits', () => {
    expect(normalizeAllocationNumber('12345')).toBeNull();
    expect(normalizeAllocationNumber('N/A')).toBeNull();
  });

  it('returns null for missing values', () => {
    expect(normalizeAllocationNumber(null)).toBeNull();
    expect(normalizeAllocationNumber(undefined)).toBeNull();
    expect(normalizeAllocationNumber('')).toBeNull();
  });
});
