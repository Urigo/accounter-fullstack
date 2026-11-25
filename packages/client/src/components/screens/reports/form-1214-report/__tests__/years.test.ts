import { describe, expect, it } from 'vitest';
import { resolveForm1214Year, sortForm1214Years } from '../years.js';

describe('resolveForm1214Year', () => {
  const supported = [2024, 2025];

  it('uses the URL year when form 1214 supports it', () => {
    expect(resolveForm1214Year('2024', supported)).toBe(2024);
  });

  it('falls back to the latest supported year without a URL year', () => {
    expect(resolveForm1214Year(null, supported)).toBe(2025);
    expect(resolveForm1214Year('', supported)).toBe(2025);
  });

  it('falls back to the latest supported year for an unsupported or malformed URL year', () => {
    expect(resolveForm1214Year('2019', supported)).toBe(2025);
    expect(resolveForm1214Year('20245', supported)).toBe(2025);
    expect(resolveForm1214Year('abcd', supported)).toBe(2025);
  });

  it('has no year while the supported years are unknown', () => {
    expect(resolveForm1214Year('2024', [])).toBeUndefined();
  });
});

describe('sortForm1214Years', () => {
  it('lists each year once, latest first', () => {
    expect(sortForm1214Years([2024, 2026, 2025, 2026])).toEqual([2026, 2025, 2024]);
  });
});
