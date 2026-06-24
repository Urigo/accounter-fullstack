/**
 * End-to-end tests: raw MIME webhook event → full gateway pipeline.
 *
 * Unlike `integration.test.ts` (which swaps in a passthrough treatment stub),
 * these tests drive the REAL treatment step (`applyTreatment`). Only the two
 * leaf I/O dependencies are stubbed — `renderHtmlToPdf` (would launch Chromium)
 * and `fetchInternalLinkDocuments` (would hit the network) — so the document
 * set is genuinely decided by the business config returned from control, the
 * email body, and the raw attachments. This exercises the full chain:
 *
 *   webhook → verifier (real HMAC) → mime-extractor (real) → orchestrate (real)
 *           → applyTreatment (real, stubbed leaf I/O) → serverClient (mocked)
 *
 * Covered scenarios:
 *  1. Email with body only (no attachments).
 *  2. Email with no matched business (with / without document attachments).
 *  3. Email with various business suggestions — body-as-doc, internal links,
 *     and attachment allowlists — where some attachments match the suggestion
 *     and some do not.
 */
import { PassThrough } from 'node:stream';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { IngestReasonCode } from '../contracts.js';
import type { ExtractedDocument } from '../mime-extractor.js';
import type {
  BusinessEmailConfig,
  ControlResult,
  IngestInput,
  IngestResult,
} from '../server-client.js';
import { applyTreatment as realApplyTreatment, type TreatmentDeps } from '../treatment.js';
import { CloudflareAuthenticityVerifier } from '../verifier.js';
import { createWebhookHandler } from '../webhook.js';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// ---------------------------------------------------------------------------
// Request / response plumbing (mirrors integration.test.ts)
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'test-secret-e2e';
const NOW_SECONDS = 1_700_000_000;

function sign(body: string, secret: string, timestamp: number): string {
  const payload = Buffer.concat([Buffer.from(`${timestamp}.`), Buffer.from(body)]);
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function makeReq(
  body: string,
  overrides: Record<string, string | undefined> = {},
): IncomingMessage {
  const stream = new PassThrough();
  stream.end(body);
  const headers: Record<string, string> = {
    'x-cf-timestamp': String(NOW_SECONDS),
    'x-cf-signature': sign(body, WEBHOOK_SECRET, NOW_SECONDS),
    'x-cf-nonce': `nonce-${Math.random().toString(36).slice(2)}`,
    'x-cf-recipient': 'invoices@acme.example.com',
    'x-cf-message-id': '<msg-e2e@mail.example.com>',
    'x-correlation-id': 'e2e-corr',
  };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete headers[k];
    else headers[k] = v;
  }
  return Object.assign(stream, {
    headers,
    method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as IncomingMessage;
}

function makeRes() {
  let status: number | undefined;
  let body: string | undefined;
  const res = {
    writeHead: vi.fn((code: number) => {
      status = code;
    }),
    end: vi.fn((data: string) => {
      body = data;
    }),
    setHeader: vi.fn(),
    headersSent: false,
    getHeader: vi.fn(),
  } as unknown as ServerResponse;
  return {
    res,
    getStatus: () => status,
    getBody: () => (body ? (JSON.parse(body) as Record<string, unknown>) : undefined),
  };
}

function makeVerifier() {
  return new CloudflareAuthenticityVerifier({
    webhookSecret: WEBHOOK_SECRET,
    ipAllowlist: [],
    currentTimeSeconds: () => NOW_SECONDS,
  });
}

// ---------------------------------------------------------------------------
// MIME builders
// ---------------------------------------------------------------------------

/** A plain-text-body-only email with no attachments. */
function plainBodyEmail(bodyText: string): string {
  return [
    'From: vendor@example.com',
    'To: invoices@acme.example.com',
    'Subject: Invoice',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    bodyText,
  ].join('\r\n');
}

type AttachmentSpec = { mimeType: string; filename: string; bytes: Buffer };

/** A multipart email with an HTML body plus zero or more attachments. */
function multipartEmail(htmlBody: string, attachments: AttachmentSpec[]): string {
  const boundary = 'E2EBOUNDARY';
  const parts: string[] = [
    'From: vendor@example.com',
    'To: invoices@acme.example.com',
    'Subject: Invoice',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ];
  for (const att of attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      att.bytes.toString('base64'),
    );
  }
  parts.push(`--${boundary}--`);
  return parts.join('\r\n');
}

const pdfBytes = (tag: string) => Buffer.from(`%PDF-1.4 ${tag}`);
const pngBytes = (tag: string) => Buffer.from(`\x89PNG ${tag}`);
const jpgBytes = (tag: string) => Buffer.from(`\xff\xd8\xff ${tag}`);

// ---------------------------------------------------------------------------
// Treatment with stubbed leaf I/O — real applyTreatment logic, no Chromium /
// network. Tracks how often each leaf was invoked so tests can assert that the
// body→PDF / internal-link branches actually fired.
// ---------------------------------------------------------------------------

function stubDoc(mimeType: string, filename: string): ExtractedDocument {
  const content = Buffer.from(filename);
  return { filename, mimeType, content, size: content.length, sha256: `sha-${filename}` };
}

function makeTreatment(linkDocsByPattern: Record<string, ExtractedDocument[]> = {}) {
  const renderHtmlToPdf = vi.fn(async (_html: string) =>
    stubDoc('application/pdf', 'body.pdf'),
  );
  const fetchInternalLinkDocuments = vi.fn(async (_body: string, pattern: string) =>
    linkDocsByPattern[pattern] ?? [],
  );
  const deps: TreatmentDeps = { renderHtmlToPdf, fetchInternalLinkDocuments };
  // Wrap the REAL applyTreatment so the webhook drives genuine treatment logic
  // while the leaf I/O stays stubbed.
  const applyTreatment: typeof realApplyTreatment = input => realApplyTreatment(input, deps);
  return { applyTreatment, renderHtmlToPdf, fetchInternalLinkDocuments };
}

// ---------------------------------------------------------------------------
// Server client mock — control + ingest. The ingest mock echoes the document
// set back so tests can assert on what treatment produced; the outcome is
// derived (QUARANTINED/NO_DOCUMENTS when empty, INSERTED otherwise).
// ---------------------------------------------------------------------------

const GRANT = {
  id: 'grant-row',
  jti: 'grant-jti',
  tenantId: 'tenant-001',
  action: 'ingest',
  expiresAt: '2026-01-01T12:05:00Z',
};

function controlSuccess(businessEmailConfig: BusinessEmailConfig | null): ControlResult {
  return {
    success: true,
    decision: {
      id: 'dec-row',
      tenantId: 'tenant-001',
      decisionId: 'decision-001',
      auditId: 'audit-ctrl',
      grant: GRANT,
      businessEmailConfig,
    },
  };
}

function makeServerClient(controlResult: ControlResult) {
  const requestIngest = vi.fn(async (input: IngestInput): Promise<IngestResult> => {
    // Model the server-side NO_DOCUMENTS quarantine backstop so the e2e flow
    // reflects what the real server would do with an empty document set.
    if (input.extractedDocuments.length === 0) {
      return {
        success: true,
        outcome: 'QUARANTINED',
        ingestId: null,
        existingIngestId: null,
        auditId: 'audit-ingest',
        reasonCode: 'NO_DOCUMENTS',
      };
    }
    return {
      success: true,
      outcome: 'INSERTED',
      ingestId: 'ingest-001',
      existingIngestId: null,
      auditId: 'audit-ingest',
      reasonCode: null,
    };
  });
  return {
    requestControl: vi.fn().mockResolvedValue(controlResult),
    requestIngest,
  };
}

function makeHandler(
  controlResult: ControlResult,
  treatment: ReturnType<typeof makeTreatment>,
) {
  const serverClient = makeServerClient(controlResult);
  const handler = createWebhookHandler({
    verifier: makeVerifier(),
    featureFlags: { v2Enabled: true, shadowMode: false },
    serverClient,
    applyTreatment: treatment.applyTreatment,
  });
  return { handler, serverClient };
}

/** Run the webhook end-to-end and return status + ingest documents. */
async function run(mime: string, controlResult: ControlResult, treatment = makeTreatment()) {
  const { handler, serverClient } = makeHandler(controlResult, treatment);
  const { res, getStatus, getBody } = makeRes();
  await handler(makeReq(mime), res);
  const ingestCall = serverClient.requestIngest.mock.calls[0]?.[0] as IngestInput | undefined;
  return {
    status: getStatus(),
    body: getBody(),
    serverClient,
    treatment,
    ingestCalled: serverClient.requestIngest.mock.calls.length > 0,
    ingestDocs: ingestCall?.extractedDocuments ?? [],
  };
}

// ===========================================================================
// 1. Email with body only
// ===========================================================================

describe('e2e — email with body only', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders an unrecognized body-only email to a single PDF and ingests it', async () => {
    const r = await run(plainBodyEmail('Please pay the attached invoice.'), controlSuccess(null));

    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ status: 'accepted', outcome: 'INSERTED' });
    // No business → treatment renders the body to PDF; that is the only document.
    expect(r.treatment.renderHtmlToPdf).toHaveBeenCalledOnce();
    expect(r.treatment.fetchInternalLinkDocuments).not.toHaveBeenCalled();
    expect(r.ingestDocs).toHaveLength(1);
    expect(r.ingestDocs[0]).toMatchObject({ mimeType: 'application/pdf', filename: 'body.pdf' });
  });

  it('renders the body for a recognized business that opts in via emailBody', async () => {
    const config: BusinessEmailConfig = {
      businessId: 'biz-1',
      internalEmailLinks: null,
      emailBody: true,
      attachments: null,
    };
    const r = await run(plainBodyEmail('Statement enclosed.'), controlSuccess(config));

    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ outcome: 'INSERTED' });
    expect(r.treatment.renderHtmlToPdf).toHaveBeenCalledOnce();
    expect(r.ingestDocs).toHaveLength(1);
  });

  it('quarantines a body-only email when the business does NOT opt into emailBody', async () => {
    const config: BusinessEmailConfig = {
      businessId: 'biz-1',
      internalEmailLinks: null,
      emailBody: false,
      attachments: null,
    };
    const r = await run(plainBodyEmail('Just a note, nothing attached.'), controlSuccess(config));

    expect(r.status).toBe(202);
    // No attachments and the body is not rendered → empty set → NO_DOCUMENTS.
    expect(r.treatment.renderHtmlToPdf).not.toHaveBeenCalled();
    expect(r.ingestDocs).toHaveLength(0);
    expect(r.body).toMatchObject({ outcome: 'QUARANTINED', reasonCode: 'NO_DOCUMENTS' });
  });
});

// ===========================================================================
// 2. Email with no matched business
// ===========================================================================

describe('e2e — email with no matched business', () => {
  beforeEach(() => vi.clearAllMocks());

  it('quarantines an empty-body, no-attachment email (NO_DOCUMENTS)', async () => {
    const r = await run(plainBodyEmail('   '), controlSuccess(null));

    expect(r.status).toBe(202);
    expect(r.treatment.renderHtmlToPdf).not.toHaveBeenCalled();
    expect(r.ingestCalled).toBe(true);
    expect(r.ingestDocs).toHaveLength(0);
    expect(r.body).toMatchObject({ outcome: 'QUARANTINED', reasonCode: 'NO_DOCUMENTS' });
  });

  it('keeps all document attachments and also renders the body when no business matched', async () => {
    const mime = multipartEmail('<p>Invoice + receipt attached</p>', [
      { mimeType: 'application/pdf', filename: 'invoice.pdf', bytes: pdfBytes('inv') },
      { mimeType: 'image/jpeg', filename: 'receipt.jpg', bytes: jpgBytes('rcpt') },
    ]);
    const r = await run(mime, controlSuccess(null));

    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ outcome: 'INSERTED' });
    // Unrecognized → no attachment allowlist, all kept + body rendered.
    expect(r.treatment.renderHtmlToPdf).toHaveBeenCalledOnce();
    const mimes = r.ingestDocs.map(d => d.mimeType).sort();
    expect(mimes).toEqual(['application/pdf', 'application/pdf', 'image/jpeg']);
  });

  it('does NOT surface a business when control reports an unknown alias', async () => {
    const r = await run(plainBodyEmail('hi'), {
      success: false,
      reason: IngestReasonCode.UNKNOWN_ALIAS,
      message: 'alias not registered',
    });

    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ failed: true, reason: IngestReasonCode.UNKNOWN_ALIAS });
    // Control denied → treatment and ingest never run.
    expect(r.ingestCalled).toBe(false);
    expect(r.treatment.renderHtmlToPdf).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 3. Email with various business suggestions
// ===========================================================================

describe('e2e — business suggestions (body / links / attachments)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters attachments to the configured allowlist (PDF kept, PNG dropped)', async () => {
    const config: BusinessEmailConfig = {
      businessId: 'biz-1',
      internalEmailLinks: null,
      emailBody: false,
      attachments: ['PDF'],
    };
    const mime = multipartEmail('<p>see attached</p>', [
      { mimeType: 'application/pdf', filename: 'invoice.pdf', bytes: pdfBytes('inv') },
      { mimeType: 'image/png', filename: 'logo.png', bytes: pngBytes('logo') },
    ]);
    const r = await run(mime, controlSuccess(config));

    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ outcome: 'INSERTED' });
    // Only the PDF survives the allowlist; the PNG suggestion does not match.
    expect(r.ingestDocs).toHaveLength(1);
    expect(r.ingestDocs[0]).toMatchObject({ mimeType: 'application/pdf', filename: 'invoice.pdf' });
    // emailBody is false → body is not rendered.
    expect(r.treatment.renderHtmlToPdf).not.toHaveBeenCalled();
  });

  it('quarantines when none of the attachments match the allowlist (no match)', async () => {
    const config: BusinessEmailConfig = {
      businessId: 'biz-1',
      internalEmailLinks: null,
      emailBody: false,
      attachments: ['JPEG'],
    };
    const mime = multipartEmail('<p>see attached</p>', [
      { mimeType: 'application/pdf', filename: 'invoice.pdf', bytes: pdfBytes('inv') },
      { mimeType: 'image/png', filename: 'logo.png', bytes: pngBytes('logo') },
    ]);
    const r = await run(mime, controlSuccess(config));

    expect(r.status).toBe(202);
    // Allowlist is JPEG only; PDF + PNG are both dropped → empty → quarantine.
    expect(r.ingestDocs).toHaveLength(0);
    expect(r.body).toMatchObject({ outcome: 'QUARANTINED', reasonCode: 'NO_DOCUMENTS' });
  });

  it('combines body-as-doc, allowlisted attachments, and internal links', async () => {
    const linkPattern = 'https://portal.example.com/doc';
    const config: BusinessEmailConfig = {
      businessId: 'biz-1',
      internalEmailLinks: [linkPattern],
      emailBody: true,
      attachments: ['PDF', 'JPEG'],
    };
    const treatment = makeTreatment({
      [linkPattern]: [stubDoc('application/pdf', 'linked.pdf')],
    });
    const mime = multipartEmail(
      `<p>Docs at <a href="${linkPattern}/123">portal</a></p>`,
      [
        { mimeType: 'application/pdf', filename: 'invoice.pdf', bytes: pdfBytes('inv') },
        { mimeType: 'image/jpeg', filename: 'receipt.jpg', bytes: jpgBytes('rcpt') },
        // PNG is not in the allowlist → should be dropped (a non-matching suggestion).
        { mimeType: 'image/png', filename: 'logo.png', bytes: pngBytes('logo') },
      ],
    );
    const r = await run(mime, controlSuccess(config), treatment);

    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ outcome: 'INSERTED' });
    expect(r.treatment.renderHtmlToPdf).toHaveBeenCalledOnce();
    expect(r.treatment.fetchInternalLinkDocuments).toHaveBeenCalledWith(
      expect.any(String),
      linkPattern,
    );

    const filenames = r.ingestDocs.map(d => d.filename).sort();
    // Kept attachments (invoice.pdf, receipt.jpg) + body.pdf + linked.pdf.
    // logo.png is filtered out because PNG is not allowlisted.
    expect(filenames).toEqual(['body.pdf', 'invoice.pdf', 'linked.pdf', 'receipt.jpg']);
    expect(filenames).not.toContain('logo.png');
  });

  it('survives an internal-link fetch failure and still ingests the other documents', async () => {
    const linkPattern = 'https://portal.example.com/doc';
    const config: BusinessEmailConfig = {
      businessId: 'biz-1',
      internalEmailLinks: [linkPattern],
      emailBody: false,
      attachments: null,
    };
    const treatment = makeTreatment();
    treatment.fetchInternalLinkDocuments.mockRejectedValueOnce(new Error('portal down'));
    const mime = multipartEmail(`<p><a href="${linkPattern}/9">portal</a></p>`, [
      { mimeType: 'application/pdf', filename: 'invoice.pdf', bytes: pdfBytes('inv') },
    ]);
    const r = await run(mime, controlSuccess(config), treatment);

    expect(r.status).toBe(202);
    expect(r.body).toMatchObject({ outcome: 'INSERTED' });
    // Link fetch threw but was swallowed; the attachment still went through.
    expect(r.ingestDocs).toHaveLength(1);
    expect(r.ingestDocs[0]).toMatchObject({ filename: 'invoice.pdf' });
  });
});
