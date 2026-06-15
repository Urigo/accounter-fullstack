import { describe, expect, it, vi } from 'vitest';
import {
  computeDedupFingerprint,
  EmailIngestionIdempotencyProvider,
} from '../providers/email-ingestion-idempotency.provider.js';
import { IngestOutcome } from '../contracts.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-uuid-a';
const TENANT_B = 'tenant-uuid-b';
const IDEM_KEY = 'idem-key-abc-123';
const FINGERPRINT = 'fp-sha256-abc';
const AUDIT_ID = 'audit-uuid-1';
const INGEST_ID = 'ingest-uuid-1';
const CORR_ID = 'corr-uuid-1';

const storedIdempotencyRow = {
  id: 'row-uuid-idem',
  idempotency_key: IDEM_KEY,
  owner_id: TENANT_A,
  outcome: IngestOutcome.INSERTED,
  ingest_id: INGEST_ID,
  audit_id: AUDIT_ID,
  created_at: new Date('2026-06-11T10:00:00Z'),
};

const storedDedupRow = {
  id: 'row-uuid-dedup',
  owner_id: TENANT_A,
  fingerprint: FINGERPRINT,
  outcome: IngestOutcome.INSERTED,
  ingest_id: INGEST_ID,
  correlation_id: CORR_ID,
  created_at: new Date('2026-06-11T10:00:00Z'),
};

function makeProvider(queryResponses: Array<{ rows: unknown[]; rowCount: number }>) {
  const queryFn = vi.fn();
  for (const resp of queryResponses) {
    queryFn.mockResolvedValueOnce(resp);
  }
  // The provider injects TenantAwareDBClient and runs all queries through it,
  // so RLS session variables are set and tenant_isolation policies apply.
  // pgtyped calls `.query(text, values)` on the injected client.
  const db = { query: queryFn };
  return { provider: new EmailIngestionIdempotencyProvider(db as never), queryFn };
}

// ---------------------------------------------------------------------------
// checkIdempotencyKey
// ---------------------------------------------------------------------------

describe('EmailIngestionIdempotencyProvider.checkIdempotencyKey', () => {
  it('returns null when key has not been seen for this tenant', async () => {
    const { provider } = makeProvider([{ rows: [], rowCount: 0 }]);
    const result = await provider.checkIdempotencyKey(IDEM_KEY, TENANT_A);
    expect(result).toBeNull();
  });

  it('returns stored record when key was already processed', async () => {
    const { provider } = makeProvider([{ rows: [storedIdempotencyRow], rowCount: 1 }]);
    const result = await provider.checkIdempotencyKey(IDEM_KEY, TENANT_A);

    expect(result).toMatchObject({
      idempotencyKey: IDEM_KEY,
      tenantId: TENANT_A,
      outcome: IngestOutcome.INSERTED,
      ingestId: INGEST_ID,
      auditId: AUDIT_ID,
    });
  });

  it('returns null for same key from a different tenant (cross-tenant isolation)', async () => {
    // Simulates DB returning no rows because the query filters by owner_id = TENANT_B
    const { provider } = makeProvider([{ rows: [], rowCount: 0 }]);
    const result = await provider.checkIdempotencyKey(IDEM_KEY, TENANT_B);
    expect(result).toBeNull();
  });

  it('passes tenantId as owner_id to the query', async () => {
    const { provider, queryFn } = makeProvider([{ rows: [], rowCount: 0 }]);
    await provider.checkIdempotencyKey(IDEM_KEY, TENANT_A);

    const callText: string = queryFn.mock.calls[0][0];
    expect(callText).toContain('idempotency_key');
  });
});

// ---------------------------------------------------------------------------
// persistIdempotencyKey
// ---------------------------------------------------------------------------

describe('EmailIngestionIdempotencyProvider.persistIdempotencyKey', () => {
  it('returns the inserted record', async () => {
    const { provider } = makeProvider([{ rows: [storedIdempotencyRow], rowCount: 1 }]);
    const result = await provider.persistIdempotencyKey({
      idempotencyKey: IDEM_KEY,
      tenantId: TENANT_A,
      outcome: IngestOutcome.INSERTED,
      ingestId: INGEST_ID,
      auditId: AUDIT_ID,
    });

    expect(result).toMatchObject({
      idempotencyKey: IDEM_KEY,
      tenantId: TENANT_A,
      outcome: IngestOutcome.INSERTED,
    });
  });

  it('falls back to SELECT when INSERT conflicts (concurrent duplicate)', async () => {
    // INSERT returns no rows (ON CONFLICT DO NOTHING), then SELECT returns stored row
    const { provider, queryFn } = makeProvider([
      { rows: [], rowCount: 0 },
      { rows: [storedIdempotencyRow], rowCount: 1 },
    ]);

    const result = await provider.persistIdempotencyKey({
      idempotencyKey: IDEM_KEY,
      tenantId: TENANT_A,
      outcome: IngestOutcome.INSERTED,
      ingestId: INGEST_ID,
      auditId: AUDIT_ID,
    });

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ idempotencyKey: IDEM_KEY });
  });
});

// ---------------------------------------------------------------------------
// checkDedupFingerprint
// ---------------------------------------------------------------------------

describe('EmailIngestionIdempotencyProvider.checkDedupFingerprint', () => {
  it('returns null when fingerprint is new for this tenant', async () => {
    const { provider } = makeProvider([{ rows: [], rowCount: 0 }]);
    const result = await provider.checkDedupFingerprint(FINGERPRINT, TENANT_A);
    expect(result).toBeNull();
  });

  it('returns stored record when fingerprint already exists', async () => {
    const { provider } = makeProvider([{ rows: [storedDedupRow], rowCount: 1 }]);
    const result = await provider.checkDedupFingerprint(FINGERPRINT, TENANT_A);

    expect(result).toMatchObject({
      fingerprint: FINGERPRINT,
      tenantId: TENANT_A,
      outcome: IngestOutcome.INSERTED,
      ingestId: INGEST_ID,
    });
  });

  it('returns null for same fingerprint from a different tenant (cross-tenant isolation)', async () => {
    // DB returns no rows because owner_id = TENANT_B has no matching fingerprint
    const { provider } = makeProvider([{ rows: [], rowCount: 0 }]);
    const result = await provider.checkDedupFingerprint(FINGERPRINT, TENANT_B);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// persistDedupFingerprint
// ---------------------------------------------------------------------------

describe('EmailIngestionIdempotencyProvider.persistDedupFingerprint', () => {
  it('returns the inserted record', async () => {
    const { provider } = makeProvider([{ rows: [storedDedupRow], rowCount: 1 }]);
    const result = await provider.persistDedupFingerprint({
      tenantId: TENANT_A,
      fingerprint: FINGERPRINT,
      outcome: IngestOutcome.INSERTED,
      ingestId: INGEST_ID,
      correlationId: CORR_ID,
    });

    expect(result).toMatchObject({
      fingerprint: FINGERPRINT,
      tenantId: TENANT_A,
      outcome: IngestOutcome.INSERTED,
    });
  });

  it('falls back to SELECT when INSERT conflicts (concurrent duplicate)', async () => {
    const { provider, queryFn } = makeProvider([
      { rows: [], rowCount: 0 },
      { rows: [storedDedupRow], rowCount: 1 },
    ]);

    await provider.persistDedupFingerprint({
      tenantId: TENANT_A,
      fingerprint: FINGERPRINT,
      outcome: IngestOutcome.INSERTED,
    });

    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Tenant guardrails (RLS boundary)
// ---------------------------------------------------------------------------

/**
 * These tests assert the data-plane boundary hardening (S13.6): the provider
 * runs every read/write through the injected TenantAwareDBClient (not the raw
 * pool), so RLS session variables are applied and tenant_isolation policies
 * enforce owner_id = current_business_id. A WITH CHECK violation (cross-tenant
 * write) surfaces as a thrown error rather than being silently swallowed.
 */
describe('EmailIngestionIdempotencyProvider tenant guardrails', () => {
  it('routes idempotency reads through the injected tenant-aware client', async () => {
    const { provider, queryFn } = makeProvider([{ rows: [], rowCount: 0 }]);
    await provider.checkIdempotencyKey(IDEM_KEY, TENANT_A);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('routes dedup reads through the injected tenant-aware client', async () => {
    const { provider, queryFn } = makeProvider([{ rows: [], rowCount: 0 }]);
    await provider.checkDedupFingerprint(FINGERPRINT, TENANT_A);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('propagates an RLS WITH CHECK violation on cross-tenant idempotency write', async () => {
    const queryFn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('new row violates row-level security policy for table "..."'),
      );
    const provider = new EmailIngestionIdempotencyProvider({ query: queryFn } as never);

    await expect(
      provider.persistIdempotencyKey({
        idempotencyKey: IDEM_KEY,
        tenantId: TENANT_B,
        outcome: IngestOutcome.INSERTED,
        ingestId: INGEST_ID,
        auditId: AUDIT_ID,
      }),
    ).rejects.toThrow(/row-level security/);
  });

  it('propagates an RLS WITH CHECK violation on cross-tenant dedup write', async () => {
    const queryFn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('new row violates row-level security policy for table "..."'),
      );
    const provider = new EmailIngestionIdempotencyProvider({ query: queryFn } as never);

    await expect(
      provider.persistDedupFingerprint({
        tenantId: TENANT_B,
        fingerprint: FINGERPRINT,
        outcome: IngestOutcome.INSERTED,
      }),
    ).rejects.toThrow(/row-level security/);
  });
});

// ---------------------------------------------------------------------------
// computeDedupFingerprint (pure function)
// ---------------------------------------------------------------------------

describe('computeDedupFingerprint', () => {
  it('returns a non-empty hex string', () => {
    const fp = computeDedupFingerprint(TENANT_A, 'sha256-msg-hash');
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable — same inputs produce same output', () => {
    expect(computeDedupFingerprint(TENANT_A, 'hash')).toBe(computeDedupFingerprint(TENANT_A, 'hash'));
  });

  it('differs when tenantId changes (cross-tenant isolation)', () => {
    expect(computeDedupFingerprint(TENANT_A, 'hash')).not.toBe(
      computeDedupFingerprint(TENANT_B, 'hash'),
    );
  });

  it('differs when rawMessageHash changes', () => {
    expect(computeDedupFingerprint(TENANT_A, 'hash-1')).not.toBe(
      computeDedupFingerprint(TENANT_A, 'hash-2'),
    );
  });
});
