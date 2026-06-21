import { describe, expect, it } from 'vitest';
import { computeDedupFingerprint } from '../providers/email-ingestion-dedup.js';

const TENANT_A = 'tenant-uuid-a';
const TENANT_B = 'tenant-uuid-b';

describe('computeDedupFingerprint', () => {
  it('returns a 64-char hex SHA-256 digest', () => {
    const fp = computeDedupFingerprint(TENANT_A, 'sha256-msg-hash');
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same tenant + hash', () => {
    expect(computeDedupFingerprint(TENANT_A, 'hash')).toBe(computeDedupFingerprint(TENANT_A, 'hash'));
  });

  it('is tenant-scoped — same hash for different tenants yields different fingerprints', () => {
    expect(computeDedupFingerprint(TENANT_A, 'hash')).not.toBe(
      computeDedupFingerprint(TENANT_B, 'hash'),
    );
  });

  it('differs when the message hash differs for the same tenant', () => {
    expect(computeDedupFingerprint(TENANT_A, 'hash-1')).not.toBe(
      computeDedupFingerprint(TENANT_A, 'hash-2'),
    );
  });
});
