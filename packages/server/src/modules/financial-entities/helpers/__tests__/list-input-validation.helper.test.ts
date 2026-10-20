import { describe, expect, it } from 'vitest';
import { dedupeCaseInsensitive, dedupeExact } from '../list-input-validation.helper.js';

describe('dedupeCaseInsensitive', () => {
  it('removes case- and whitespace-insensitive duplicates, keeping the first occurrence', () => {
    expect(dedupeCaseInsensitive(['a@x.com', ' A@X.com ', 'b@x.com'])).toEqual([
      'a@x.com',
      'b@x.com',
    ]);
  });
});

describe('dedupeExact', () => {
  it('removes exact repeats, keeping the first occurrence', () => {
    expect(dedupeExact(['GOOGLE', 'AMAZON', 'GOOGLE'])).toEqual(['GOOGLE', 'AMAZON']);
  });

  it('keeps case variants, which match different descriptions', () => {
    expect(dedupeExact(['GOOGLE', 'Google'])).toEqual(['GOOGLE', 'Google']);
  });
});
