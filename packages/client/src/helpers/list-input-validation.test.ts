import { describe, expect, it } from 'vitest';
import {
  duplicateEmailError,
  duplicateExactError,
  hasNoDuplicateEmails,
  hasNoPhraseOverlap,
  phraseConflictError,
} from './list-input-validation.js';

describe('duplicateEmailError', () => {
  it('returns null when the email is new', () => {
    expect(duplicateEmailError(['a@x.com'], 'b@x.com')).toBeNull();
  });

  it('detects case- and whitespace-insensitive duplicates', () => {
    expect(duplicateEmailError(['a@x.com'], ' A@X.com ')).toContain('already in the list');
  });
});

describe('duplicateExactError', () => {
  it('detects an exact repeat after trimming', () => {
    expect(duplicateExactError(['https://x.com/a'], ' https://x.com/a ')).toContain(
      'already in the list',
    );
  });

  it('allows entries that differ only in case', () => {
    expect(duplicateExactError(['https://x.com/A'], 'https://x.com/a')).toBeNull();
  });
});

describe('phraseConflictError', () => {
  it('returns null for an unrelated phrase', () => {
    expect(phraseConflictError(['GOOGLE'], 'AMAZON')).toBeNull();
  });

  it('flags an exact duplicate', () => {
    expect(phraseConflictError(['GOOGLE'], ' GOOGLE ')).toContain('already in the list');
  });

  it('flags a new phrase that an existing, broader phrase already covers', () => {
    expect(phraseConflictError(['GOOGL'], 'GOOGLE')).toBe('"GOOGLE" is already covered by "GOOGL"');
  });

  it('flags a new phrase that is broader than an existing one', () => {
    expect(phraseConflictError(['GOOGLE'], 'GOOGL')).toBe(
      '"GOOGL" is broader than "GOOGLE" — remove "GOOGLE" first',
    );
  });

  it('allows case variants, which match different descriptions', () => {
    expect(phraseConflictError(['GOOGLE'], 'Google')).toBeNull();
    expect(phraseConflictError(['GOOGLE ADS'], 'Google')).toBeNull();
  });
});

describe('hasNoDuplicateEmails', () => {
  it('is true for unique emails and false for case-insensitive duplicates', () => {
    expect(hasNoDuplicateEmails(['a@x.com', 'b@x.com'])).toBe(true);
    expect(hasNoDuplicateEmails(['a@x.com', 'A@X.com'])).toBe(false);
  });
});

describe('hasNoPhraseOverlap', () => {
  it('is true for unrelated phrases and case variants', () => {
    expect(hasNoPhraseOverlap(['GOOGLE', 'AMAZON'])).toBe(true);
    expect(hasNoPhraseOverlap(['GOOGLE', 'Google'])).toBe(true);
  });

  it('is false when one phrase contains another', () => {
    expect(hasNoPhraseOverlap(['GOOGL', 'GOOGLE'])).toBe(false);
  });
});
