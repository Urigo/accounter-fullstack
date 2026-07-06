import { describe, expect, it } from 'vitest';
import {
  cleanPhrases,
  dedupeList,
  findDuplicateEntry,
  findPhraseConflict,
} from '../list-input-validation.helper.js';

describe('findDuplicateEntry', () => {
  it('returns null when all entries are unique', () => {
    expect(findDuplicateEntry(['a@x.com', 'b@x.com'])).toBeNull();
  });

  it('detects case-insensitive, whitespace-insensitive duplicates', () => {
    expect(findDuplicateEntry(['a@x.com', ' A@X.com '])).toBe(' A@X.com ');
  });
});

describe('dedupeList', () => {
  it('removes case-insensitive duplicates keeping the first occurrence', () => {
    expect(dedupeList(['a@x.com', 'A@X.com', 'b@x.com'])).toEqual(['a@x.com', 'b@x.com']);
  });
});

describe('findPhraseConflict', () => {
  it('returns null for distinct, non-overlapping phrases', () => {
    expect(findPhraseConflict(['GOOGLE', 'AMAZON'])).toBeNull();
  });

  it('flags exact duplicates (case-insensitive)', () => {
    expect(findPhraseConflict(['GOOGLE', 'google'])).toEqual({
      type: 'duplicate',
      value: 'google',
    });
  });

  it('flags a phrase that is a substring of another', () => {
    expect(findPhraseConflict(['GOOGL', 'GOOGLE'])).toEqual({
      type: 'substring',
      shorter: 'GOOGL',
      longer: 'GOOGLE',
    });
  });

  it('detects the overlap regardless of order', () => {
    expect(findPhraseConflict(['GOOGLE', 'GOOGL'])).toEqual({
      type: 'substring',
      shorter: 'GOOGL',
      longer: 'GOOGLE',
    });
  });
});

describe('cleanPhrases', () => {
  it('drops the broader phrase when one contains another', () => {
    expect(cleanPhrases(['GOOGL', 'GOOGLE', 'AMAZON'])).toEqual(['GOOGLE', 'AMAZON']);
  });

  it('removes case-insensitive duplicates', () => {
    expect(cleanPhrases(['GOOGLE', 'google', 'AMAZON'])).toEqual(['GOOGLE', 'AMAZON']);
  });
});
