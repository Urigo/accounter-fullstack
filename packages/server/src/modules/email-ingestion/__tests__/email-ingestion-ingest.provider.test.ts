import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailIngestionIngestProvider } from '../providers/email-ingestion-ingest.provider.js';
import { EmailIngestionControlProvider } from '../providers/email-ingestion-control.provider.js';
import { IngestOutcome, IngestReasonCode } from '../contracts.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-11T12:00:00.000Z');
const FUTURE = new Date(NOW.getTime() + 5 * 60 * 1000);

const TENANT_ID = 'tenant-uuid-a';
const JTI = 'jti-uuid';
const IDEM_KEY = 'idem-key-001';
const MSG_ID = 'msg-abc-123';
const MSG_HASH = 'sha256-abc';
const CORR_ID = 'corr-001';

const VALID_GRANT = {
  valid: true as const,
  grant: { jti: JTI, tenantId: TENANT_ID, action: 'ingest', expiresAt: FUTURE },
};

const BASE_INPUT = {
  grantJti: JTI,
  idempotencyKey: IDEM_KEY,
  tenantId: TENANT_ID,
  messageId: MSG_ID,
  rawMessageHash: MSG_HASH,
  correlationId: CORR_ID,
  extractedDocuments: [{ hash: 'doc-hash', sizeBytes: 1024, mimeType: 'application/pdf', filename: 'invoice.pdf' }],
};

// ---------------------------------------------------------------------------
// Mock helper
// ---------------------------------------------------------------------------

type QueryResponse = { rows: unknown[]; rowCount: number };

function makeProvider(
  grantResult: Awaited<ReturnType<EmailIngestionControlProvider['validateAndConsumeGrant']>>,
  dbResponses: QueryResponse[],
) {
  const validateAndConsumeGrant = vi.fn().mockResolvedValue(grantResult);
  const controlProvider = { validateAndConsumeGrant } as unknown as EmailIngestionControlProvider;

  const queryFn = vi.fn();
  for (const resp of dbResponses) {
    queryFn.mockResolvedValueOnce(resp);
  }
  const pool = { query: queryFn };
  const dbProvider = { pool } as never;

  return {
    provider: new EmailIngestionIngestProvider(dbProvider, controlProvider),
    validateAndConsumeGrant,
    queryFn,
  };
}

// ---------------------------------------------------------------------------
// performIngest — grant validation
// ---------------------------------------------------------------------------

describe('EmailIngestionIngestProvider.performIngest — grant validation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns REJECTED with GRANT_INVALID when grant validation fails', async () => {
    const { provider } = makeProvider(
      { valid: false, reason: IngestReasonCode.GRANT_INVALID },
      [],
    );

    const result = await provider.performIngest(BASE_INPUT);
    expect(result).toEqual({ outcome: IngestOutcome.REJECTED, reasonCode: IngestReasonCode.GRANT_INVALID });
  });

  it('returns REJECTED with TENANT_MISMATCH when grant tenant does not match input', async () => {
    const { provider } = makeProvider(
      { valid: false, reason: IngestReasonCode.TENANT_MISMATCH },
      [],
    );

    const result = await provider.performIngest(BASE_INPUT);
    expect(result).toEqual({ outcome: IngestOutcome.REJECTED, reasonCode: IngestReasonCode.TENANT_MISMATCH });
  });

  it('does not query the DB when grant validation fails', async () => {
    const { provider, queryFn } = makeProvider(
      { valid: false, reason: IngestReasonCode.GRANT_INVALID },
      [],
    );

    await provider.performIngest(BASE_INPUT);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('calls validateAndConsumeGrant with the correct grant binding fields', async () => {
    const { provider, validateAndConsumeGrant } = makeProvider(
      VALID_GRANT,
      // idempotency check (miss) → dedup check (miss) → insert idem → insert dedup
      [
        { rows: [], rowCount: 0 },
        { rows: [], rowCount: 0 },
        { rows: [{ id: 'idem-id', idempotency_key: IDEM_KEY, owner_id: TENANT_ID, outcome: 'inserted', ingest_id: 'ingest-1', audit_id: 'audit-1', created_at: NOW }], rowCount: 1 },
        { rows: [{ id: 'dedup-id', owner_id: TENANT_ID, fingerprint: 'fp', outcome: 'inserted', ingest_id: 'ingest-1', correlation_id: CORR_ID, created_at: NOW }], rowCount: 1 },
      ],
    );

    await provider.performIngest(BASE_INPUT);

    expect(validateAndConsumeGrant).toHaveBeenCalledWith({
      jti: JTI,
      tenantId: TENANT_ID,
      messageId: MSG_ID,
      rawMessageHash: MSG_HASH,
    });
  });
});

// ---------------------------------------------------------------------------
// performIngest — idempotency check
// ---------------------------------------------------------------------------

describe('EmailIngestionIngestProvider.performIngest — idempotency', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns DUPLICATE with existing record when idempotency key was seen', async () => {
    const storedRow = {
      id: 'idem-row',
      idempotency_key: IDEM_KEY,
      owner_id: TENANT_ID,
      outcome: IngestOutcome.INSERTED,
      ingest_id: 'prior-ingest-id',
      audit_id: 'prior-audit-id',
      created_at: NOW,
    };
    const { provider } = makeProvider(VALID_GRANT, [{ rows: [storedRow], rowCount: 1 }]);

    const result = await provider.performIngest(BASE_INPUT);

    expect(result).toMatchObject({
      outcome: IngestOutcome.DUPLICATE,
      existingIngestId: 'prior-ingest-id',
      auditId: 'prior-audit-id',
    });
  });

  it('does not check dedup when idempotency key hit returns early', async () => {
    const storedRow = {
      id: 'idem-row', idempotency_key: IDEM_KEY, owner_id: TENANT_ID,
      outcome: IngestOutcome.INSERTED, ingest_id: 'prior', audit_id: 'audit', created_at: NOW,
    };
    const { provider, queryFn } = makeProvider(VALID_GRANT, [{ rows: [storedRow], rowCount: 1 }]);

    await provider.performIngest(BASE_INPUT);
    // Only one DB call — the idempotency lookup; no dedup lookup
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// performIngest — dedup check
// ---------------------------------------------------------------------------

describe('EmailIngestionIngestProvider.performIngest — dedup', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns DUPLICATE when dedup fingerprint was seen', async () => {
    const dedupRow = {
      id: 'dedup-row', owner_id: TENANT_ID, fingerprint: 'fp',
      outcome: IngestOutcome.INSERTED, ingest_id: 'prior-ingest-id',
      correlation_id: CORR_ID, created_at: NOW,
    };
    const { provider } = makeProvider(VALID_GRANT, [
      { rows: [], rowCount: 0 },       // idempotency miss
      { rows: [dedupRow], rowCount: 1 }, // dedup hit
    ]);

    const result = await provider.performIngest(BASE_INPUT);

    expect(result).toMatchObject({
      outcome: IngestOutcome.DUPLICATE,
      existingIngestId: 'prior-ingest-id',
    });
  });
});

// ---------------------------------------------------------------------------
// performIngest — quarantine
// ---------------------------------------------------------------------------

describe('EmailIngestionIngestProvider.performIngest — quarantine', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns QUARANTINED with NO_DOCUMENTS when no documents extracted', async () => {
    const quarantineRow = { id: 'q-id' };
    const idemRow = {
      id: 'idem-row', idempotency_key: IDEM_KEY, owner_id: TENANT_ID,
      outcome: IngestOutcome.QUARANTINED, ingest_id: null, audit_id: 'audit-1', created_at: NOW,
    };
    const dedupRow = {
      id: 'dedup-row', owner_id: TENANT_ID, fingerprint: 'fp',
      outcome: IngestOutcome.QUARANTINED, ingest_id: null, correlation_id: CORR_ID, created_at: NOW,
    };
    const { provider } = makeProvider(VALID_GRANT, [
      { rows: [], rowCount: 0 },          // idempotency miss
      { rows: [], rowCount: 0 },          // dedup miss
      { rows: [quarantineRow], rowCount: 1 }, // quarantine insert
      { rows: [idemRow], rowCount: 1 },   // idempotency insert
      { rows: [dedupRow], rowCount: 1 },  // dedup insert
    ]);

    const result = await provider.performIngest({ ...BASE_INPUT, extractedDocuments: [] });

    expect(result).toMatchObject({
      outcome: IngestOutcome.QUARANTINED,
      reasonCode: IngestReasonCode.NO_DOCUMENTS,
    });
  });
});

// ---------------------------------------------------------------------------
// performIngest — happy path (inserted)
// ---------------------------------------------------------------------------

describe('EmailIngestionIngestProvider.performIngest — inserted', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns INSERTED with ingestId and auditId on happy path', async () => {
    const idemRow = {
      id: 'idem-row', idempotency_key: IDEM_KEY, owner_id: TENANT_ID,
      outcome: IngestOutcome.INSERTED, ingest_id: 'new-ingest-id', audit_id: 'new-audit-id', created_at: NOW,
    };
    const dedupRow = {
      id: 'dedup-row', owner_id: TENANT_ID, fingerprint: 'fp',
      outcome: IngestOutcome.INSERTED, ingest_id: 'new-ingest-id', correlation_id: CORR_ID, created_at: NOW,
    };
    const { provider } = makeProvider(VALID_GRANT, [
      { rows: [], rowCount: 0 },        // idempotency miss
      { rows: [], rowCount: 0 },        // dedup miss
      { rows: [idemRow], rowCount: 1 }, // idempotency insert
      { rows: [dedupRow], rowCount: 1 },// dedup insert
    ]);

    const result = await provider.performIngest(BASE_INPUT);

    expect(result).toMatchObject({
      outcome: IngestOutcome.INSERTED,
      ingestId: 'new-ingest-id',
      auditId: 'new-audit-id',
    });
  });

  it('makes exactly 4 DB calls on happy path (check idem, check dedup, insert idem, insert dedup)', async () => {
    const idemRow = {
      id: 'idem-row', idempotency_key: IDEM_KEY, owner_id: TENANT_ID,
      outcome: IngestOutcome.INSERTED, ingest_id: 'new-ingest-id', audit_id: 'new-audit-id', created_at: NOW,
    };
    const dedupRow = {
      id: 'dedup-row', owner_id: TENANT_ID, fingerprint: 'fp',
      outcome: IngestOutcome.INSERTED, ingest_id: 'new-ingest-id', correlation_id: CORR_ID, created_at: NOW,
    };
    const { provider, queryFn } = makeProvider(VALID_GRANT, [
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [idemRow], rowCount: 1 },
      { rows: [dedupRow], rowCount: 1 },
    ]);

    await provider.performIngest(BASE_INPUT);

    expect(queryFn).toHaveBeenCalledTimes(4);
  });
});
