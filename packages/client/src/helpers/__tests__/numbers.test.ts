import { describe, expect, it } from 'vitest';
import { formatCompactNumber } from '../numbers.js';

describe('formatCompactNumber', () => {
  it('renders the magnitudes contract operation limits come in', () => {
    expect(formatCompactNumber(30_000_000_000n)).toBe('30B');
    expect(formatCompactNumber(45_000_000_000n)).toBe('45B');
    expect(formatCompactNumber(600_000_000n)).toBe('600M');
    expect(formatCompactNumber(1_500_000_000n)).toBe('1.5B');
    expect(formatCompactNumber(250_000n)).toBe('250K');
  });

  it('leaves small values and zero as they are', () => {
    expect(formatCompactNumber(0n)).toBe('0');
    expect(formatCompactNumber(999n)).toBe('999');
    expect(formatCompactNumber(500n)).toBe('500');
  });

  it('rounds to one decimal, so a value entered in millions by mistake still reads as small', () => {
    expect(formatCompactNumber(30_000n)).toBe('30K');
    expect(formatCompactNumber(1_234_567n)).toBe('1.2M');
  });

  it('accepts a plain number too', () => {
    expect(formatCompactNumber(2_000_000)).toBe('2M');
  });
});
