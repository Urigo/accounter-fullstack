import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { DocumentType } from '../../../shared/enums.js';
import { AnthropicProvider } from '../../app-providers/anthropic.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { BusinessesProvider } from '../../financial-entities/providers/businesses.provider.js';
import { EmailIngestionIngestProvider } from '../providers/email-ingestion-ingest.provider.js';
import { EmailIngestionControlProvider } from '../providers/email-ingestion-control.provider.js';
import { IngestOutcome, IngestReasonCode } from '../contracts.js';
import { EmailKind } from '../helpers/email-ingestion-classify.helper.js';

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

const BUSINESS_ID = 'business-uuid-x';

const VALID_GRANT = {
  valid: true as const,
  grant: {
    jti: JTI,
    tenantId: TENANT_ID,
    action: 'ingest',
    expiresAt: FUTURE,
    businessId: null,
    classification: EmailKind.DIRECT,
  },
};

const VALID_GRANT_WITH_BUSINESS = {
  valid: true as const,
  grant: {
    jti: JTI,
    tenantId: TENANT_ID,
    action: 'ingest',
    expiresAt: FUTURE,
    businessId: BUSINESS_ID,
    classification: EmailKind.DIRECT,
  },
};

// Self-issued: the control step classified the email as a copy of a document the
// tenant issued itself.
const VALID_GRANT_SELF_ISSUED = {
  valid: true as const,
  grant: {
    jti: JTI,
    tenantId: TENANT_ID,
    action: 'ingest',
    expiresAt: FUTURE,
    businessId: null,
    classification: EmailKind.SELF_ISSUED,
  },
};

// A grant issued before the classification column existed: ingest falls back to the
// old `businessId === tenantId` inference so in-flight grants keep working.
const LEGACY_GRANT_SELF_ISSUED = {
  valid: true as const,
  grant: {
    jti: JTI,
    tenantId: TENANT_ID,
    action: 'ingest',
    expiresAt: FUTURE,
    businessId: TENANT_ID,
    classification: null,
  },
};

// A manual forward whose only recoverable addresses belonged to the tenant. The old
// inference bound the tenant as its own issuer and withheld the document; the
// classification keeps it on the normal path.
const VALID_GRANT_FORWARDED = {
  valid: true as const,
  grant: {
    jti: JTI,
    tenantId: TENANT_ID,
    action: 'ingest',
    expiresAt: FUTURE,
    businessId: null,
    classification: EmailKind.FORWARDED,
  },
};

const DOC_CONTENT_B64 = Buffer.from('%PDF-1.4 fake invoice bytes').toString('base64');

// A row of the tenant-scoped businesses read in prepareDocuments, which feeds the OCR
// business matcher (and, via `country`, the foreign-counterparty VAT-0 fallback).
function businessRow(id: string, name: string, country: string | null) {
  return { id, name, hebrew_name: null, vat_number: null, suggestion_data: null, country };
}

/**
 * The two prepare-phase reads that follow the document-by-hash check, in call order:
 * the tenant's businesses (for business matching) and the tenant's locality.
 */
function prepareContextRows(businesses = [businessRow(BUSINESS_ID, 'Vendor Ltd', 'IL')]) {
  return [
    { rows: businesses, rowCount: businesses.length },
    { rows: [{ locality: 'IL' }], rowCount: 1 },
  ];
}

const BASE_INPUT = {
  grantJti: JTI,
  idempotencyKey: IDEM_KEY,
  tenantId: TENANT_ID,
  messageId: MSG_ID,
  rawMessageHash: MSG_HASH,
  correlationId: CORR_ID,
  extractedDocuments: [{ hash: 'doc-hash', sizeBytes: 1024, mimeType: 'application/pdf', filename: 'invoice.pdf' }],
};

// OCR runs via getOcrData(injector, file, false) → AnthropicProvider.extractInvoiceDetails.
// A mock operation injector returns a stub Anthropic provider that yields an INVOICE,
// so figureOutSides attributes the recognized business as the document creditor.
const extractInvoiceDetails = vi.fn().mockResolvedValue({ type: DocumentType.Invoice });
// getDocumentFromUrlsAndOcrData falls back to VAT-0 for foreign counterparties when the
// OCR result carries no VAT — it looks up the counterparty business and the admin's own
// context to compare locality. Neither is under test here, so both loaders resolve to
// undefined, which short-circuits that fallback and leaves ocrData.vat untouched.
const businessesProvider = {
  getBusinessByIdLoader: { load: vi.fn().mockResolvedValue(undefined) },
};
const adminContextProvider = {
  adminContextByOwnerIdLoader: { load: vi.fn().mockResolvedValue(undefined) },
};
const ocrInjector = {
  get: (token: unknown) => {
    if (token === AnthropicProvider) return { extractInvoiceDetails };
    if (token === BusinessesProvider) return businessesProvider;
    if (token === AdminContextProvider) return adminContextProvider;
    return undefined;
  },
} as unknown as Injector;

// ---------------------------------------------------------------------------
// Mock helper
// ---------------------------------------------------------------------------

type QueryResponse = { rows: unknown[]; rowCount: number };

function isControlStatement(text: string): boolean {
  return (
    text === 'BEGIN' ||
    text === 'COMMIT' ||
    text === 'ROLLBACK' ||
    text.includes('set_config')
  );
}

function makeProvider(
  grantResult: Awaited<ReturnType<EmailIngestionControlProvider['validateAndConsumeGrant']>>,
  dbResponses: QueryResponse[],
) {
  // validateGrant is the read-only gate (resolves the bound business, rejects an
  // invalid grant) that runs before the fallible document prep; validateAndConsumeGrant
  // is the atomic consume that runs inside the write transaction. Both are stubbed to
  // return the same grant result so a single fixture drives the whole flow.
  const validateGrant = vi.fn().mockResolvedValue(grantResult);
  const validateAndConsumeGrant = vi.fn().mockResolvedValue(grantResult);
  const controlProvider = {
    validateGrant,
    validateAndConsumeGrant,
  } as unknown as EmailIngestionControlProvider;

  const uploadInvoiceToCloudinary = vi
    .fn()
    .mockResolvedValue({ fileUrl: 'https://cdn/file.pdf', imageUrl: 'https://cdn/file.jpg' });
  const cloudinaryProvider = { uploadInvoiceToCloudinary } as never;

  // Tenant-bound work runs inside a transaction on a pooled client. The mock
  // serves BEGIN / SET LOCAL / COMMIT transparently and dispenses `dbResponses`
  // (in order) only for the actual data queries. `dataQueries` records the
  // data-query SQL (and `dataCalls` the SQL + bound values) so tests can assert
  // which queries ran and with what parameters.
  const responses = [...dbResponses];
  const dataQueries: string[] = [];
  const dataCalls: Array<{ text: string; values: unknown[] }> = [];
  const queryFn = vi.fn((text: unknown, values?: unknown) => {
    const sqlText = typeof text === 'string' ? text : '';
    if (isControlStatement(sqlText)) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    dataQueries.push(sqlText);
    dataCalls.push({ text: sqlText, values: Array.isArray(values) ? values : [] });
    return Promise.resolve(responses.shift() ?? { rows: [], rowCount: 0 });
  });

  const release = vi.fn();
  const connect = vi.fn().mockResolvedValue({ query: queryFn, release });
  const pool = { query: vi.fn(), connect };
  const dbProvider = { pool } as never;

  return {
    provider: new EmailIngestionIngestProvider(dbProvider, controlProvider, cloudinaryProvider),
    validateGrant,
    validateAndConsumeGrant,
    uploadInvoiceToCloudinary,
    queryFn,
    connect,
    release,
    dataQueries,
    dataCalls,
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
      [{ rows: [], rowCount: 0 }], // early idempotency miss
    );

    const result = await provider.performIngest(BASE_INPUT, ocrInjector);
    expect(result).toEqual({ outcome: IngestOutcome.REJECTED, reasonCode: IngestReasonCode.GRANT_INVALID });
  });

  it('returns REJECTED with TENANT_MISMATCH when grant tenant does not match input', async () => {
    const { provider } = makeProvider(
      { valid: false, reason: IngestReasonCode.TENANT_MISMATCH },
      [{ rows: [], rowCount: 0 }], // early idempotency miss
    );

    const result = await provider.performIngest(BASE_INPUT, ocrInjector);
    expect(result).toEqual({ outcome: IngestOutcome.REJECTED, reasonCode: IngestReasonCode.TENANT_MISMATCH });
  });

  it('does not upload or persist writes when grant validation fails', async () => {
    const { provider, uploadInvoiceToCloudinary, dataCalls } = makeProvider(
      { valid: false, reason: IngestReasonCode.GRANT_INVALID },
      [{ rows: [], rowCount: 0 }], // early idempotency miss
    );

    await provider.performIngest(BASE_INPUT, ocrInjector);
    expect(uploadInvoiceToCloudinary).not.toHaveBeenCalled();
    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema'))).toBe(false);
  });

  it('validates and consumes the grant with the correct binding fields', async () => {
    const { provider, validateGrant, validateAndConsumeGrant } = makeProvider(
      VALID_GRANT,
      // early idem miss → idempotency check (miss) → dedup check (miss) → insert idem → insert dedup
      [
        { rows: [], rowCount: 0 },
        { rows: [], rowCount: 0 },
        { rows: [], rowCount: 0 },
        { rows: [{ id: 'idem-id', idempotency_key: IDEM_KEY, owner_id: TENANT_ID, outcome: 'inserted', ingest_id: 'ingest-1', audit_id: 'audit-1', created_at: NOW }], rowCount: 1 },
        { rows: [{ id: 'dedup-id', owner_id: TENANT_ID, fingerprint: 'fp', outcome: 'inserted', ingest_id: 'ingest-1', correlation_id: CORR_ID, created_at: NOW }], rowCount: 1 },
      ],
    );

    await provider.performIngest(BASE_INPUT, ocrInjector);

    const binding = { jti: JTI, tenantId: TENANT_ID, messageId: MSG_ID, rawMessageHash: MSG_HASH };
    // Read-only validation runs first (no transaction client)…
    expect(validateGrant).toHaveBeenCalledWith(binding);
    // …then the atomic consume runs inside the write transaction (with a client).
    expect(validateAndConsumeGrant).toHaveBeenCalledWith(binding, expect.anything());
  });

  it('quarantines with UPLOAD_FAILED (not a raw throw) when document preparation fails', async () => {
    // The regression this guards: a Cloudinary upload failure during document prep used to
    // throw raw. Combined with consuming the grant up front, that stranded an accepted email
    // with no durable record. Now prep runs before the grant is consumed, and a prep failure
    // is turned into an UPLOAD_FAILED quarantine — the grant is consumed atomically with the
    // quarantine write, so the failure is recorded and reprocessable rather than invisible.
    const idemRow = {
      id: 'idem-row', idempotency_key: IDEM_KEY, owner_id: TENANT_ID,
      outcome: IngestOutcome.QUARANTINED, ingest_id: null, audit_id: 'audit-up', created_at: NOW,
    };
    const dedupRow = {
      id: 'dedup-row', owner_id: TENANT_ID, fingerprint: 'fp',
      outcome: IngestOutcome.QUARANTINED, ingest_id: null, correlation_id: CORR_ID, created_at: NOW,
    };
    const { provider, validateAndConsumeGrant, uploadInvoiceToCloudinary, dataCalls } = makeProvider(
      VALID_GRANT_WITH_BUSINESS,
      [
        { rows: [], rowCount: 0 }, // early idempotency miss
        { rows: [], rowCount: 0 }, // prepareDocuments: checkDocumentByHash → new candidate
        ...prepareContextRows(), // prepareDocuments: businesses + admin locality
        { rows: [{ id: 'q-id' }], rowCount: 1 }, // quarantine insert
        { rows: [idemRow], rowCount: 1 }, // idempotency insert
        { rows: [dedupRow], rowCount: 1 }, // dedup insert
      ],
    );
    uploadInvoiceToCloudinary.mockRejectedValueOnce(new Error('cloudinary down'));

    const inputWithContent = {
      ...BASE_INPUT,
      extractedDocuments: [
        { hash: 'doc-hash', sizeBytes: 1024, mimeType: 'application/pdf', filename: 'invoice.pdf', content: DOC_CONTENT_B64 },
      ],
    };

    const result = await provider.performIngest(inputWithContent, ocrInjector);

    expect(result).toMatchObject({
      outcome: IngestOutcome.QUARANTINED,
      reasonCode: IngestReasonCode.UPLOAD_FAILED,
    });
    expect(uploadInvoiceToCloudinary).toHaveBeenCalled();
    // Grant consumed atomically with the quarantine write, and the failure is recorded.
    expect(validateAndConsumeGrant).toHaveBeenCalledWith(
      { jti: JTI, tenantId: TENANT_ID, messageId: MSG_ID, rawMessageHash: MSG_HASH },
      expect.anything(),
    );
    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema.email_ingestion_quarantine'))).toBe(true);
    // No charge/document rows written for a failed-preparation quarantine.
    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema.charges'))).toBe(false);
    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema.documents'))).toBe(false);
  });

  it('rethrows an unexpected (non-preparation) error without consuming the grant', async () => {
    // Errors that are not DocumentPreparationError (e.g. a DB failure) must not be masked as a
    // quarantine — they surface raw, leaving the grant unconsumed so the ingest can be retried.
    const { provider, validateAndConsumeGrant } = makeProvider(VALID_GRANT_WITH_BUSINESS, [
      { rows: [], rowCount: 0 }, // early idempotency miss
    ]);
    // Fail the prepareDocuments hash-dedup read (runs before the upload try/catch), which is not
    // wrapped in DocumentPreparationError.
    const err = new Error('db connection lost');
    vi.spyOn(provider as unknown as { prepareDocuments: () => Promise<unknown> }, 'prepareDocuments').mockRejectedValueOnce(err);

    await expect(provider.performIngest(BASE_INPUT, ocrInjector)).rejects.toThrow('db connection lost');
    expect(validateAndConsumeGrant).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// performIngest — self-issued skip
// ---------------------------------------------------------------------------

describe('EmailIngestionIngestProvider.performIngest — self-issued', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const quarantineRow = { id: 'q-self' };
  const idemRow = {
    id: 'idem-row',
    idempotency_key: IDEM_KEY,
    owner_id: TENANT_ID,
    outcome: IngestOutcome.IGNORED,
    ingest_id: null,
    audit_id: 'audit-self',
    created_at: NOW,
  };
  const dedupRow = {
    id: 'dedup-row',
    owner_id: TENANT_ID,
    fingerprint: 'fp',
    outcome: IngestOutcome.IGNORED,
    ingest_id: null,
    correlation_id: CORR_ID,
    created_at: NOW,
  };
  const inputWithContent = {
    ...BASE_INPUT,
    extractedDocuments: [
      {
        hash: 'doc-hash',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        filename: 'invoice.pdf',
        content: DOC_CONTENT_B64,
      },
    ],
  };

  it('returns IGNORED with SELF_ISSUED when control classified the email as self-issued', async () => {
    const { provider, uploadInvoiceToCloudinary, dataCalls } = makeProvider(VALID_GRANT_SELF_ISSUED, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [quarantineRow], rowCount: 1 }, // quarantine insert
      { rows: [idemRow], rowCount: 1 }, // idempotency insert
      { rows: [dedupRow], rowCount: 1 }, // dedup insert
    ]);

    const result = await provider.performIngest(inputWithContent, ocrInjector);

    expect(result).toMatchObject({
      outcome: IngestOutcome.IGNORED,
      reasonCode: IngestReasonCode.SELF_ISSUED,
    });
    // No document work (upload/OCR run together in prepareDocuments) and no
    // charge/document rows are written — the email is skipped, not inserted.
    expect(uploadInvoiceToCloudinary).not.toHaveBeenCalled();
    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema.charges'))).toBe(false);
    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema.documents'))).toBe(false);
    // An audit row is still recorded, so the decision stays inspectable.
    expect(
      dataCalls.some(c => c.text.includes('INTO accounter_schema.email_ingestion_quarantine')),
    ).toBe(true);
  });

  it('persists audit + idempotency + dedup so a retry short-circuits, without dedup lookup query', async () => {
    const { provider, validateAndConsumeGrant, dataCalls, dataQueries } = makeProvider(
      VALID_GRANT_SELF_ISSUED,
      [
        { rows: [], rowCount: 0 }, // early idempotency miss
        { rows: [quarantineRow], rowCount: 1 }, // quarantine insert
        { rows: [idemRow], rowCount: 1 }, // idempotency insert
        { rows: [dedupRow], rowCount: 1 }, // dedup insert
      ],
    );

    await provider.performIngest(BASE_INPUT, ocrInjector);

    // The grant IS validated/consumed; the self-issued check then short-circuits
    // before any dedup lookup, charge or document insert — but records the audit
    // row plus the idempotency key + dedup fingerprint so retries short-circuit
    // at the early idempotency check.
    expect(validateAndConsumeGrant).toHaveBeenCalled();
    expect(dataQueries).toHaveLength(4); // early idem lookup + audit insert + idem insert + dedup insert
    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema.email_ingestion_quarantine'))).toBe(true);
    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema.email_ingestion_idempotency_keys'))).toBe(true);
    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema.email_ingestion_dedup_fingerprints'))).toBe(true);
  });

  it('falls back to businessId === tenantId for a grant issued before the classification column', async () => {
    const { provider, uploadInvoiceToCloudinary } = makeProvider(LEGACY_GRANT_SELF_ISSUED, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [quarantineRow], rowCount: 1 }, // audit insert
      { rows: [idemRow], rowCount: 1 }, // idempotency insert
      { rows: [dedupRow], rowCount: 1 }, // dedup insert
    ]);

    const result = await provider.performIngest(inputWithContent, ocrInjector);

    expect(result).toMatchObject({
      outcome: IngestOutcome.IGNORED,
      reasonCode: IngestReasonCode.SELF_ISSUED,
    });
    expect(uploadInvoiceToCloudinary).not.toHaveBeenCalled();
  });

  // The regression this whole change exists for: a supplier invoice forwarded in by
  // a colleague used to resolve to the tenant's own business and be withheld.
  it('does not skip a FORWARDED email, even though no business was recognized', async () => {
    const { provider, uploadInvoiceToCloudinary } = makeProvider(VALID_GRANT_FORWARDED, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [], rowCount: 0 }, // document hash dedup miss
      { rows: [], rowCount: 0 }, // businesses for matching
      { rows: [], rowCount: 0 }, // user_context locality
    ]);

    await provider.performIngest(inputWithContent, ocrInjector).catch(() => undefined);

    // It reached document preparation instead of short-circuiting.
    expect(uploadInvoiceToCloudinary).toHaveBeenCalled();
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
    // The early idempotency check fires first and finds the row → returns DUPLICATE
    // before validateAndConsumeGrant is ever called.
    const { provider } = makeProvider(VALID_GRANT, [{ rows: [storedRow], rowCount: 1 }]);

    const result = await provider.performIngest(BASE_INPUT, ocrInjector);

    expect(result).toMatchObject({
      outcome: IngestOutcome.DUPLICATE,
      existingIngestId: 'prior-ingest-id',
      auditId: 'prior-audit-id',
    });
  });

  it('does not consume the grant when idempotency key was seen (early check fires before validateAndConsumeGrant)', async () => {
    const storedRow = {
      id: 'idem-row',
      idempotency_key: IDEM_KEY,
      owner_id: TENANT_ID,
      outcome: IngestOutcome.INSERTED,
      ingest_id: 'prior-ingest-id',
      audit_id: 'prior-audit-id',
      created_at: NOW,
    };
    const { provider, validateAndConsumeGrant } = makeProvider(
      VALID_GRANT,
      [{ rows: [storedRow], rowCount: 1 }], // early idem HIT
    );

    await provider.performIngest(BASE_INPUT, ocrInjector);

    // The grant was NOT consumed — the early check short-circuited before validateAndConsumeGrant.
    // This is the fix for the timeout+retry scenario: a retry of a committed ingest returns
    // DUPLICATE without burning the (now-gone) grant.
    expect(validateAndConsumeGrant).not.toHaveBeenCalled();
  });

  it('does not check dedup when idempotency key hit returns early', async () => {
    const storedRow = {
      id: 'idem-row', idempotency_key: IDEM_KEY, owner_id: TENANT_ID,
      outcome: IngestOutcome.INSERTED, ingest_id: 'prior', audit_id: 'audit', created_at: NOW,
    };
    const { provider, dataQueries } = makeProvider(VALID_GRANT, [{ rows: [storedRow], rowCount: 1 }]);

    await provider.performIngest(BASE_INPUT, ocrInjector);
    // Only one data query — the early idempotency lookup; no dedup lookup, no grant consumed
    expect(dataQueries).toHaveLength(1);
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
      { rows: [], rowCount: 0 },       // early idempotency miss
      { rows: [], rowCount: 0 },       // in-tx idempotency miss
      { rows: [dedupRow], rowCount: 1 }, // dedup hit
    ]);

    const result = await provider.performIngest(BASE_INPUT, ocrInjector);

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
      { rows: [], rowCount: 0 },          // early idempotency miss
      { rows: [], rowCount: 0 },          // in-tx idempotency miss
      { rows: [], rowCount: 0 },          // dedup miss
      { rows: [quarantineRow], rowCount: 1 }, // quarantine insert
      { rows: [idemRow], rowCount: 1 },   // idempotency insert
      { rows: [dedupRow], rowCount: 1 },  // dedup insert
    ]);

    const result = await provider.performIngest(
      { ...BASE_INPUT, extractedDocuments: [] },
      ocrInjector,
    );

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
      { rows: [], rowCount: 0 },        // early idempotency miss
      { rows: [], rowCount: 0 },        // in-tx idempotency miss
      { rows: [], rowCount: 0 },        // dedup miss
      { rows: [idemRow], rowCount: 1 }, // idempotency insert
      { rows: [dedupRow], rowCount: 1 },// dedup insert
    ]);

    const result = await provider.performIngest(BASE_INPUT, ocrInjector);

    expect(result).toMatchObject({
      outcome: IngestOutcome.INSERTED,
      ingestId: 'new-ingest-id',
      auditId: 'new-audit-id',
    });
  });

  it('makes exactly 5 data queries on happy path (early idem + check idem + check dedup + insert idem + insert dedup)', async () => {
    const idemRow = {
      id: 'idem-row', idempotency_key: IDEM_KEY, owner_id: TENANT_ID,
      outcome: IngestOutcome.INSERTED, ingest_id: 'new-ingest-id', audit_id: 'new-audit-id', created_at: NOW,
    };
    const dedupRow = {
      id: 'dedup-row', owner_id: TENANT_ID, fingerprint: 'fp',
      outcome: IngestOutcome.INSERTED, ingest_id: 'new-ingest-id', correlation_id: CORR_ID, created_at: NOW,
    };
    const { provider, dataQueries } = makeProvider(VALID_GRANT, [
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [idemRow], rowCount: 1 },
      { rows: [dedupRow], rowCount: 1 },
    ]);

    await provider.performIngest(BASE_INPUT, ocrInjector);

    expect(dataQueries).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// performIngest — document persistence (Workstream D, inline bytes)
// ---------------------------------------------------------------------------

describe('EmailIngestionIngestProvider.performIngest — document persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const idemRow = {
    id: 'idem-row',
    idempotency_key: IDEM_KEY,
    owner_id: TENANT_ID,
    outcome: IngestOutcome.INSERTED,
    ingest_id: 'charge-1',
    audit_id: 'audit-1',
    created_at: NOW,
  };
  const dedupRow = {
    id: 'dedup-row',
    owner_id: TENANT_ID,
    fingerprint: 'fp',
    outcome: IngestOutcome.INSERTED,
    ingest_id: 'charge-1',
    correlation_id: CORR_ID,
    created_at: NOW,
  };
  const inputWithContent = {
    ...BASE_INPUT,
    extractedDocuments: [
      {
        hash: 'doc-hash',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        filename: 'invoice.pdf',
        content: DOC_CONTENT_B64,
      },
    ],
  };

  it('uploads, creates a charge, and inserts the document when bytes are present', async () => {
    const { provider, uploadInvoiceToCloudinary, dataCalls } = makeProvider(
      VALID_GRANT_WITH_BUSINESS,
      [
        { rows: [], rowCount: 0 }, // early idempotency miss
        { rows: [], rowCount: 0 }, // document-by-hash miss (prepare tx, pre-upload)
        ...prepareContextRows(), // prepareDocuments: businesses + admin locality
        { rows: [], rowCount: 0 }, // idempotency miss
        { rows: [], rowCount: 0 }, // dedup fingerprint miss
        { rows: [{ id: 'charge-1' }], rowCount: 1 }, // charge insert
        { rows: [{ id: 'doc-1' }], rowCount: 1 }, // document insert
        { rows: [idemRow], rowCount: 1 }, // idempotency insert
        { rows: [dedupRow], rowCount: 1 }, // dedup insert
      ],
    );

    const result = await provider.performIngest(inputWithContent, ocrInjector);

    expect(result).toMatchObject({ outcome: IngestOutcome.INSERTED, ingestId: 'charge-1' });
    expect(uploadInvoiceToCloudinary).toHaveBeenCalledTimes(1);
    expect(uploadInvoiceToCloudinary).toHaveBeenCalledWith(
      expect.stringContaining('data:application/pdf;base64,'),
    );
    // OCR runs at ingest (matching the legacy path) rather than landing UNPROCESSED.
    expect(extractInvoiceDetails).toHaveBeenCalled();

    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema.charges'))).toBe(true);
    const docInsert = dataCalls.find(c => c.text.includes('INTO accounter_schema.documents'));
    expect(docInsert).toBeDefined();
    // the document is classified from OCR (INVOICE), not UNPROCESSED
    expect(docInsert?.values).toContain(DocumentType.Invoice);
    // and the recognized issuing business is attributed as the document creditor
    expect(docInsert?.values).toContain(BUSINESS_ID);
  });

  // `insertIngestDocumentFull` binds creditor_id and debtor_id last, in that order.
  const sides = (call?: { values: unknown[] }) => ({
    creditorId: call?.values.at(-2),
    debtorId: call?.values.at(-1),
  });

  const insertedRows = [
    { rows: [], rowCount: 0 }, // idempotency miss
    { rows: [], rowCount: 0 }, // dedup fingerprint miss
    { rows: [{ id: 'charge-1' }], rowCount: 1 }, // charge insert
    { rows: [{ id: 'doc-1' }], rowCount: 1 }, // document insert
    { rows: [idemRow], rowCount: 1 }, // idempotency insert
    { rows: [dedupRow], rowCount: 1 }, // dedup insert
  ];

  it("feeds the tenant's businesses and locality to the OCR business matcher", async () => {
    // Regression: `getOcrData` used to resolve these through the auth-coupled
    // BusinessesProvider / AdminContextProvider, which throw in this control-plane
    // context; the bare catch turned that into an empty business list, so every
    // `suggestedIssuer` came back null and no document was ever matched by name/VAT.
    extractInvoiceDetails.mockClear();

    const { provider } = makeProvider(VALID_GRANT_WITH_BUSINESS, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [], rowCount: 0 }, // document-by-hash miss (prepare tx, pre-upload)
      ...prepareContextRows(),
      ...insertedRows,
    ]);

    await provider.performIngest(inputWithContent, ocrInjector);

    expect(extractInvoiceDetails).toHaveBeenCalledWith(
      expect.anything(),
      [
        {
          id: BUSINESS_ID,
          name: 'Vendor Ltd',
          hebrew_name: null,
          vat_number: null,
          suggestion_data: null,
          locality: 'IL',
        },
      ],
      { id: TENANT_ID, locality: 'IL' },
    );
  });

  it('attributes the OCR-matched issuer as creditor when the grant recognized no business', async () => {
    // The reported case: mail forwarded by an aggregator (e.g. wellybox) whose address
    // is in no business's `suggestion_data.emails`, so control-time recognition yields
    // no business — but OCR reads the issuer's legal name off the document and matches
    // it. Before, such documents were inserted with a NULL creditor.
    const OCR_MATCHED_ID = 'business-uuid-from-ocr';
    extractInvoiceDetails.mockResolvedValueOnce({
      type: DocumentType.Invoice,
      suggestedIssuer: OCR_MATCHED_ID,
      suggestedRecipient: TENANT_ID,
    });

    const { provider, dataCalls } = makeProvider(VALID_GRANT, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [], rowCount: 0 }, // document-by-hash miss (prepare tx, pre-upload)
      ...prepareContextRows([businessRow(OCR_MATCHED_ID, 'Anthropic, PBC', 'US')]),
      ...insertedRows,
    ]);

    const result = await provider.performIngest(inputWithContent, ocrInjector);

    expect(result).toMatchObject({ outcome: IngestOutcome.INSERTED });
    const docInsert = dataCalls.find(c => c.text.includes('INTO accounter_schema.documents'));
    expect(sides(docInsert)).toEqual({ creditorId: OCR_MATCHED_ID, debtorId: TENANT_ID });
  });

  it('flips the sides when OCR identifies the tenant as the issuer', async () => {
    // `isOwnerIssuer` was previously never set on this path, so sides were always
    // creditor=counterparty / debtor=tenant. An owner-issued document must invert.
    const OCR_MATCHED_ID = 'business-uuid-recipient';
    extractInvoiceDetails.mockResolvedValueOnce({
      type: DocumentType.Invoice,
      suggestedIssuer: TENANT_ID,
      suggestedRecipient: OCR_MATCHED_ID,
    });

    const { provider, dataCalls } = makeProvider(VALID_GRANT, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [], rowCount: 0 }, // document-by-hash miss (prepare tx, pre-upload)
      ...prepareContextRows([businessRow(OCR_MATCHED_ID, 'Client Ltd', 'IL')]),
      ...insertedRows,
    ]);

    await provider.performIngest(inputWithContent, ocrInjector);

    const docInsert = dataCalls.find(c => c.text.includes('INTO accounter_schema.documents'));
    expect(sides(docInsert)).toEqual({ creditorId: TENANT_ID, debtorId: OCR_MATCHED_ID });
  });

  it('keeps the grant-recognized business when the OCR match disagrees, and warns', async () => {
    // The sender-address match is the higher-confidence signal and stays authoritative;
    // the disagreement is logged so the precedence can be revisited with real data.
    const OCR_MATCHED_ID = 'business-uuid-from-ocr';
    extractInvoiceDetails.mockResolvedValueOnce({
      type: DocumentType.Invoice,
      suggestedIssuer: OCR_MATCHED_ID,
      suggestedRecipient: TENANT_ID,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { provider, dataCalls } = makeProvider(VALID_GRANT_WITH_BUSINESS, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [], rowCount: 0 }, // document-by-hash miss (prepare tx, pre-upload)
      ...prepareContextRows([
        businessRow(BUSINESS_ID, 'Vendor Ltd', 'IL'),
        businessRow(OCR_MATCHED_ID, 'Other Vendor', 'IL'),
      ]),
      ...insertedRows,
    ]);

    await provider.performIngest(inputWithContent, ocrInjector);

    const docInsert = dataCalls.find(c => c.text.includes('INTO accounter_schema.documents'));
    expect(sides(docInsert)).toEqual({ creditorId: BUSINESS_ID, debtorId: TENANT_ID });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('counterparty disagreement'));
    warn.mockRestore();
  });

  it('inserts with no creditor when neither the grant nor OCR identifies a business', async () => {
    // No recognition at all must still insert the document (visible and fixable in the
    // UI) rather than fail the ingest.
    const { provider, dataCalls } = makeProvider(VALID_GRANT, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [], rowCount: 0 }, // document-by-hash miss (prepare tx, pre-upload)
      ...prepareContextRows([]), // tenant has no businesses
      ...insertedRows,
    ]);

    const result = await provider.performIngest(inputWithContent, ocrInjector);

    expect(result).toMatchObject({ outcome: IngestOutcome.INSERTED });
    const docInsert = dataCalls.find(c => c.text.includes('INTO accounter_schema.documents'));
    expect(sides(docInsert)).toEqual({ creditorId: null, debtorId: TENANT_ID });
  });

  it('resolves foreign-counterparty VAT via the raw pool, not the auth-coupled providers', async () => {
    // Regression: the gateway ingest runs under a control-plane context with no auth
    // session. The foreign-counterparty VAT-0 fallback must read the counterparty
    // country + admin locality via the raw pool — never via BusinessesProvider /
    // AdminContextProvider, whose TenantAwareDBClient throws "Missing businessId in
    // AuthContext" here (which had surfaced as an UPLOAD_FAILED quarantine).
    businessesProvider.getBusinessByIdLoader.load.mockClear();
    adminContextProvider.adminContextByOwnerIdLoader.load.mockClear();

    const { provider, dataCalls } = makeProvider(VALID_GRANT_WITH_BUSINESS, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [], rowCount: 0 }, // document-by-hash miss (prepare tx, pre-upload)
      // counterparty is foreign (US) relative to the tenant locality (IL) below
      ...prepareContextRows([businessRow(BUSINESS_ID, 'Vendor Inc', 'US')]),
      { rows: [], rowCount: 0 }, // idempotency miss
      { rows: [], rowCount: 0 }, // dedup fingerprint miss
      { rows: [{ id: 'charge-1' }], rowCount: 1 }, // charge insert
      { rows: [{ id: 'doc-1' }], rowCount: 1 }, // document insert
      { rows: [idemRow], rowCount: 1 }, // idempotency insert
      { rows: [dedupRow], rowCount: 1 }, // dedup insert
    ]);

    const result = await provider.performIngest(inputWithContent, ocrInjector);

    expect(result).toMatchObject({ outcome: IngestOutcome.INSERTED, ingestId: 'charge-1' });
    // The fallback actually fired: a NULL extracted VAT resolves to 0 for a foreign
    // counterparty.
    const docInsert = dataCalls.find(c => c.text.includes('INTO accounter_schema.documents'));
    expect(docInsert?.values).toContain(0);
    // The inputs are read via the raw pool…
    expect(
      dataCalls.some(
        c => c.text.includes('FROM accounter_schema.businesses') && c.text.includes('country'),
      ),
    ).toBe(true);
    expect(
      dataCalls.some(
        c => c.text.includes('FROM accounter_schema.user_context') && c.text.includes('locality'),
      ),
    ).toBe(true);
    // …and never via the auth-coupled providers (which would throw in this context).
    expect(businessesProvider.getBusinessByIdLoader.load).not.toHaveBeenCalled();
    expect(adminContextProvider.adminContextByOwnerIdLoader.load).not.toHaveBeenCalled();
  });

  it('sets a descriptive charge description from subject, sender, and received date', async () => {
    const { provider, dataCalls } = makeProvider(VALID_GRANT_WITH_BUSINESS, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [], rowCount: 0 }, // document-by-hash miss (prepare tx, pre-upload)
      ...prepareContextRows(), // prepareDocuments: businesses + admin locality
      { rows: [], rowCount: 0 }, // idempotency miss
      { rows: [], rowCount: 0 }, // dedup fingerprint miss
      { rows: [{ id: 'charge-1' }], rowCount: 1 }, // charge insert
      { rows: [{ id: 'doc-1' }], rowCount: 1 }, // document insert
      { rows: [idemRow], rowCount: 1 }, // idempotency insert
      { rows: [dedupRow], rowCount: 1 }, // dedup insert
    ]);

    await provider.performIngest(
      {
        ...inputWithContent,
        subject: 'Invoice #42',
        sender: 'billing@vendor.com',
        receivedAt: '2026-06-24T08:30:00.000Z',
      },
      ocrInjector,
    );

    const chargeInsert = dataCalls.find(c => c.text.includes('INTO accounter_schema.charges'));
    // Hardcoded date (UTC) so a timezone-dependent regression is caught.
    expect(chargeInsert?.values).toContain(
      'Email documents: Invoice #42 (from: billing@vendor.com, Wed Jun 24 2026)',
    );
  });

  it('falls back to the message id when no subject/sender/date is present', async () => {
    const { provider, dataCalls } = makeProvider(VALID_GRANT_WITH_BUSINESS, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [], rowCount: 0 }, // document-by-hash miss (prepare tx, pre-upload)
      ...prepareContextRows(), // prepareDocuments: businesses + admin locality
      { rows: [], rowCount: 0 }, // idempotency miss
      { rows: [], rowCount: 0 }, // dedup fingerprint miss
      { rows: [{ id: 'charge-1' }], rowCount: 1 }, // charge insert
      { rows: [{ id: 'doc-1' }], rowCount: 1 }, // document insert
      { rows: [idemRow], rowCount: 1 }, // idempotency insert
      { rows: [dedupRow], rowCount: 1 }, // dedup insert
    ]);

    await provider.performIngest(inputWithContent, ocrInjector);

    const chargeInsert = dataCalls.find(c => c.text.includes('INTO accounter_schema.charges'));
    expect(chargeInsert?.values).toContain(`Email documents: ${MSG_ID}`);
  });

  it('skips upload and charge creation when the document hash already exists', async () => {
    const { provider, uploadInvoiceToCloudinary, dataCalls } = makeProvider(
      VALID_GRANT_WITH_BUSINESS,
      [
        { rows: [], rowCount: 0 }, // early idempotency miss
        { rows: [{ id: 'existing-doc' }], rowCount: 1 }, // document-by-hash HIT (prepare tx)
        { rows: [], rowCount: 0 }, // idempotency miss
        { rows: [], rowCount: 0 }, // dedup fingerprint miss
        { rows: [idemRow], rowCount: 1 }, // idempotency insert
        { rows: [dedupRow], rowCount: 1 }, // dedup insert
      ],
    );

    const result = await provider.performIngest(inputWithContent, ocrInjector);

    expect(result).toMatchObject({ outcome: IngestOutcome.INSERTED });
    expect(uploadInvoiceToCloudinary).not.toHaveBeenCalled();
    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema.charges'))).toBe(false);
    expect(dataCalls.some(c => c.text.includes('INTO accounter_schema.documents'))).toBe(false);
  });

  it('does not upload or persist when no inline bytes are present (metadata-only)', async () => {
    const { provider, uploadInvoiceToCloudinary, dataQueries } = makeProvider(VALID_GRANT, [
      { rows: [], rowCount: 0 }, // early idempotency miss
      { rows: [], rowCount: 0 }, // idempotency miss
      { rows: [], rowCount: 0 }, // dedup miss
      { rows: [idemRow], rowCount: 1 }, // idempotency insert
      { rows: [dedupRow], rowCount: 1 }, // dedup insert
    ]);

    // BASE_INPUT documents carry no `content` — persistence is a no-op.
    await provider.performIngest(BASE_INPUT, ocrInjector);

    expect(uploadInvoiceToCloudinary).not.toHaveBeenCalled();
    expect(dataQueries).toHaveLength(5);
  });
});
