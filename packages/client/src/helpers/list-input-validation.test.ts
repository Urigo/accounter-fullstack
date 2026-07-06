import { describe, expect, it } from 'vitest';
import {
  duplicateEntryError,
  hasNoDuplicateEntries,
  hasNoPhraseOverlap,
  phraseConflictError,
} from './list-input-validation.js';

describe('duplicateEntryError', () => {
  it('returns null when the value is new', () => {
    expect(duplicateEntryError(['a@x.com'], 'b@x.com')).toBeNull();
  });

  it('detects case- and whitespace-insensitive duplicates', () => {
    expect(duplicateEntryError(['a@x.com'], ' A@X.com ')).toContain('already in the list');
  });
});

describe('phraseConflictError', () => {
  it('returns null for a distinct phrase', () => {
    expect(phraseConflictError(['GOOGLE'], 'AMAZON')).toBeNull();
  });

  it('flags an exact duplicate', () => {
    expect(phraseConflictError(['GOOGLE'], 'google')).toContain('already in the list');
  });

  it('flags a new phrase already covered by an existing broader one', () => {
    expect(phraseConflictError(['GOOGL'], 'GOOGLE')).toContain('overlaps');
  });

  it('flags a new phrase that would shadow an existing more specific one', () => {
    expect(phraseConflictError(['GOOGLE'], 'GOOGL')).toContain('already covered');
  });
});

describe('hasNoDuplicateEntries', () => {
  it('is true for unique entries and false for case-insensitive duplicates', () => {
    expect(hasNoDuplicateEntries(['a@x.com', 'b@x.com'])).toBe(true);
    expect(hasNoDuplicateEntries(['a@x.com', 'A@X.com'])).toBe(false);
  });
});

describe('hasNoPhraseOverlap', () => {
  it('is true for non-overlapping phrases', () => {
    expect(hasNoPhraseOverlap(['GOOGLE', 'AMAZON'])).toBe(true);
  });

  it('is false when one phrase is a substring of another', () => {
    expect(hasNoPhraseOverlap(['GOOGL', 'GOOGLE'])).toBe(false);
  });
});
