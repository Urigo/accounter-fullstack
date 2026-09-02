import { describe, expect, it } from 'vitest';
import { extractChargeId } from '../link-document-button.js';

describe('extractChargeId', () => {
  const id = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

  it('accepts a bare UUID', () => {
    expect(extractChargeId(id)).toBe(id);
  });

  it('trims surrounding whitespace', () => {
    expect(extractChargeId(`  ${id}\n`)).toBe(id);
  });

  it('lowercases the id', () => {
    expect(extractChargeId(id.toUpperCase())).toBe(id);
  });

  it('extracts the id out of a charge link', () => {
    expect(extractChargeId(`https://accounter.example.com/charges/${id}`)).toBe(id);
  });

  it('returns undefined for input without an id', () => {
    expect(extractChargeId('')).toBeUndefined();
    expect(extractChargeId('not-a-charge')).toBeUndefined();
  });
});
