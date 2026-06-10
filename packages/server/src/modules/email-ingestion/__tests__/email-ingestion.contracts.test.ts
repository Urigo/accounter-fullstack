import { describe, expect, it } from 'vitest';
import { IngestOutcome, IngestReasonCode } from '../contracts.js';

// ---------------------------------------------------------------------------
// Completeness guards — these tests fail if a code is removed or renamed.
// ---------------------------------------------------------------------------

describe('IngestOutcome', () => {
  it('defines all required outcome values', () => {
    expect(IngestOutcome.INSERTED).toBe('inserted');
    expect(IngestOutcome.DUPLICATE).toBe('duplicate');
    expect(IngestOutcome.QUARANTINED).toBe('quarantined');
    expect(IngestOutcome.REJECTED).toBe('rejected');
  });

  it('has exactly four outcomes', () => {
    expect(Object.keys(IngestOutcome)).toHaveLength(4);
  });

  it('all values are non-empty strings', () => {
    for (const value of Object.values(IngestOutcome)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('IngestReasonCode', () => {
  const REQUIRED_CODES = [
    'UNKNOWN_ALIAS',
    'INVALID_AUTH',
    'REPLAY_DETECTED',
    'GRANT_INVALID',
    'TENANT_MISMATCH',
    'NO_DOCUMENTS',
    'PARSE_ERROR',
    'OVERSIZE_MESSAGE',
    'TIMEOUT',
    'TRANSIENT_UPSTREAM',
  ] as const;

  it.each(REQUIRED_CODES)('defines %s', code => {
    expect(IngestReasonCode[code]).toBe(code);
  });

  it('has exactly ten reason codes', () => {
    expect(Object.keys(IngestReasonCode)).toHaveLength(10);
  });

  it('all keys equal their values (self-referential constants)', () => {
    for (const [key, value] of Object.entries(IngestReasonCode)) {
      expect(key).toBe(value);
    }
  });

  it('all values are non-empty strings', () => {
    for (const value of Object.values(IngestReasonCode)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
