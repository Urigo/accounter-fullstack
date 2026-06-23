/**
 * Adversarial integration tests: Cloudflare-like webhook event → gateway orchestration
 *
 * These tests drive the full webhook handler (real verifier mock + real orchestrator +
 * mocked server HTTP responses) to prove that security invariants hold end-to-end.
 */
import { PassThrough } from 'node:stream';
import { createHash, createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { IngestReasonCode } from '../contracts.js';
import { createWebhookHandler } from '../webhook.js';
import type { ControlResult, IngestResult } from '../server-client.js';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'test-secret-abc';
const NOW_SECONDS = 1_700_000_000;

function sign(body: string, secret: string, timestamp: number): string {
  const prefix = Buffer.from(`${timestamp}.`);
  const bodyBuf = Buffer.from(body);
  const payload = Buffer.concat([prefix, bodyBuf]);
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function makeReq(
  body: string,
  secret: string = WEBHOOK_SECRET,
  overrides: Record<string, string | undefined> = {},
): IncomingMessage {
  const stream = new PassThrough();
  stream.end(body);
  const timestamp = String(NOW_SECONDS);
  const nonce = `nonce-${Math.random().toString(36).slice(2)}`;
  const sig = sign(body, secret, NOW_SECONDS);

  const headers: Record<string, string> = {
    'x-cf-timestamp': timestamp,
    'x-cf-signature': sig,
    'x-cf-nonce': nonce,
    // Routing metadata travels in headers; the body is the raw MIME message.
    'x-cf-recipient': 'invoices@acme.example.com',
    'x-cf-message-id': '<msg001@mail.example.com>',
    'x-correlation-id': 'e2e-corr-001',
    ...overrides,
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
    writeHead: vi.fn((code: number) => { status = code; }),
    end: vi.fn((data: string) => { body = data; }),
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

// The request body is the raw MIME message; routing metadata is sent in headers
// (see makeReq). This minimal message has no attachments, which is fine for these
// orchestration-focused tests — the mocked serverClient controls the outcome.
const VALID_PAYLOAD = [
  'From: sender@example.com',
  'To: invoices@acme.example.com',
  'Subject: Invoice',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'See attached.',
].join('\r\n');

const GRANT = {
  id: 'grant-001',
  jti: 'jti-001',
  tenantId: 'tenant-001',
  action: 'ingest',
  expiresAt: '2026-01-01T12:05:00Z',
};

const CONTROL_SUCCESS: ControlResult = {
  success: true,
  decision: {
    id: 'dec-001',
    tenantId: 'tenant-001',
    decisionId: 'decision-001',
    auditId: 'audit-ctrl-001',
    grant: GRANT,
    businessEmailConfig: null,
  },
};

// Treatment passthrough: forward raw attachments unchanged so these
// orchestration-focused tests never launch Chromium / hit the network.
const passthroughTreatment = () =>
  vi.fn(async (input: { attachments: unknown[] }) => input.attachments);

function makeServerClient(
  controlResult: ControlResult,
  ingestResult: IngestResult = {
    success: true,
    outcome: 'INSERTED',
    ingestId: 'ingest-001',
    existingIngestId: null,
    auditId: 'audit-ingest-001',
    reasonCode: null,
  },
) {
  return {
    requestControl: vi.fn().mockResolvedValue(controlResult),
    requestIngest: vi.fn().mockResolvedValue(ingestResult),
  };
}

// Real verifier backed by known secret — used for authenticated requests.
// Import the real class so that HMAC validation and timestamp checks run.
import { CloudflareAuthenticityVerifier } from '../verifier.js';

function makeVerifier() {
  return new CloudflareAuthenticityVerifier({
    webhookSecret: WEBHOOK_SECRET,
    ipAllowlist: [],
    currentTimeSeconds: () => NOW_SECONDS,
  });
}

// ---------------------------------------------------------------------------
// Integration — happy paths
// ---------------------------------------------------------------------------

describe('integration — happy path', () => {
  let verifier: CloudflareAuthenticityVerifier;

  beforeEach(() => {
    verifier = makeVerifier();
  });

  it('returns 202 with INSERTED outcome on a valid request', async () => {
    const serverClient = makeServerClient(CONTROL_SUCCESS);
    const handler = createWebhookHandler({
      verifier,
      featureFlags: { v2Enabled: true, shadowMode: false },
      serverClient,
      applyTreatment: passthroughTreatment(),
    });
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_PAYLOAD), res);
    expect(getStatus()).toBe(202);
    const b = getBody();
    expect(b).toMatchObject({ status: 'accepted', outcome: 'INSERTED' });
    expect((b as { correlationId: string }).correlationId).toBe('e2e-corr-001');
  });

  it('extracts a PDF attachment from the raw MIME body and forwards it to ingest', async () => {
    // Build a multipart MIME with a single base64-encoded PDF attachment.
    const pdf = Buffer.from('%PDF-1.4 fake invoice body');
    const boundary = 'MIMEBOUNDARY01';
    const mime = [
      'From: vendor@example.com',
      'To: invoices@acme.example.com',
      'Subject: Invoice',
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain',
      '',
      'See attached.',
      `--${boundary}`,
      'Content-Type: application/pdf',
      'Content-Disposition: attachment; filename="invoice.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      pdf.toString('base64'),
      `--${boundary}--`,
    ].join('\r\n');

    const serverClient = makeServerClient(CONTROL_SUCCESS);
    const handler = createWebhookHandler({
      verifier,
      featureFlags: { v2Enabled: true, shadowMode: false },
      serverClient,
      applyTreatment: passthroughTreatment(),
    });
    const { res, getStatus } = makeRes();
    await handler(makeReq(mime), res);

    expect(getStatus()).toBe(202);
    expect(serverClient.requestIngest).toHaveBeenCalledOnce();
    const ingestArg = serverClient.requestIngest.mock.calls[0][0];
    // The gateway computes the hash over the signed raw MIME body.
    expect(ingestArg.rawMessageHash).toBe(createHash('sha256').update(mime).digest('hex'));
    expect(ingestArg.extractedDocuments).toEqual([
      {
        hash: createHash('sha256').update(pdf).digest('hex'),
        sizeBytes: pdf.length,
        mimeType: 'application/pdf',
        filename: 'invoice.pdf',
        content: pdf.toString('base64'),
      },
    ]);
  });

  it('returns 202 with DUPLICATE outcome for repeated delivery', async () => {
    const serverClient = makeServerClient(CONTROL_SUCCESS, {
      success: true,
      outcome: 'DUPLICATE',
      ingestId: null,
      existingIngestId: 'ingest-prev-001',
      auditId: 'audit-ingest-dup',
      reasonCode: null,
    });
    const handler = createWebhookHandler({
      verifier,
      featureFlags: { v2Enabled: true, shadowMode: false },
      serverClient,
      applyTreatment: passthroughTreatment(),
    });
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_PAYLOAD), res);
    expect(getStatus()).toBe(202);
    expect(getBody()).toMatchObject({ status: 'accepted', outcome: 'DUPLICATE' });
  });

  it('returns 202 with QUARANTINED outcome when server quarantines', async () => {
    const serverClient = makeServerClient(CONTROL_SUCCESS, {
      success: true,
      outcome: 'QUARANTINED',
      ingestId: null,
      existingIngestId: null,
      auditId: 'audit-quar-001',
      reasonCode: 'NO_DOCUMENTS',
    });
    const handler = createWebhookHandler({
      verifier,
      featureFlags: { v2Enabled: true, shadowMode: false },
      serverClient,
      applyTreatment: passthroughTreatment(),
    });
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_PAYLOAD), res);
    expect(getStatus()).toBe(202);
    expect(getBody()).toMatchObject({ status: 'accepted', outcome: 'QUARANTINED', reasonCode: 'NO_DOCUMENTS' });
  });
});

// ---------------------------------------------------------------------------
// Integration — invalid auth (adversarial)
// ---------------------------------------------------------------------------

describe('integration — invalid auth', () => {
  it('returns 401 when signature is wrong (INVALID_AUTH)', async () => {
    const verifier = makeVerifier();
    const serverClient = makeServerClient(CONTROL_SUCCESS);
    const handler = createWebhookHandler({
      verifier,
      featureFlags: { v2Enabled: true, shadowMode: false },
      serverClient,
      applyTreatment: passthroughTreatment(),
    });
    const { res, getStatus, getBody } = makeRes();
    // Use wrong secret so HMAC check fails
    await handler(makeReq(VALID_PAYLOAD, 'wrong-secret'), res);
    expect(getStatus()).toBe(401);
    expect(getBody()).toMatchObject({ reason: IngestReasonCode.INVALID_AUTH });
    expect(serverClient.requestControl).not.toHaveBeenCalled();
  });

  it('returns 401 on nonce replay (REPLAY_DETECTED)', async () => {
    const verifier = makeVerifier();
    const serverClient = makeServerClient(CONTROL_SUCCESS);
    const handler = createWebhookHandler({
      verifier,
      featureFlags: { v2Enabled: true, shadowMode: false },
      serverClient,
      applyTreatment: passthroughTreatment(),
    });
    // First request passes
    const req1 = makeReq(VALID_PAYLOAD);
    // Capture the nonce from req1 before using it
    const nonce = (req1 as { headers: Record<string, string> }).headers['x-cf-nonce'];
    const { res: res1 } = makeRes();
    await handler(req1, res1);

    // Replay with same nonce
    const stream2 = new PassThrough();
    stream2.end(VALID_PAYLOAD);
    const req2 = Object.assign(stream2, {
      headers: {
        'x-cf-timestamp': String(NOW_SECONDS),
        'x-cf-signature': sign(VALID_PAYLOAD, WEBHOOK_SECRET, NOW_SECONDS),
        'x-cf-nonce': nonce, // same nonce = replay
        'x-cf-recipient': 'invoices@acme.example.com',
        'x-cf-message-id': '<msg001@mail.example.com>',
      },
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
    }) as unknown as IncomingMessage;

    const { res: res2, getStatus, getBody } = makeRes();
    await handler(req2, res2);
    expect(getStatus()).toBe(401);
    expect(getBody()).toMatchObject({ reason: IngestReasonCode.REPLAY_DETECTED });
  });
});

// ---------------------------------------------------------------------------
// Integration — unknown alias
// ---------------------------------------------------------------------------

describe('integration — unknown alias', () => {
  it('returns 202 with failed:true and UNKNOWN_ALIAS when alias is not registered', async () => {
    const serverClient = makeServerClient({
      success: false,
      reason: IngestReasonCode.UNKNOWN_ALIAS,
      message: 'Alias invoices@acme.example.com is not registered',
    });
    const handler = createWebhookHandler({
      verifier: makeVerifier(),
      featureFlags: { v2Enabled: true, shadowMode: false },
      serverClient,
      applyTreatment: passthroughTreatment(),
    });
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_PAYLOAD), res);
    // Gateway always returns 202 (Cloudflare must not retry)
    expect(getStatus()).toBe(202);
    expect(getBody()).toMatchObject({ failed: true, reason: IngestReasonCode.UNKNOWN_ALIAS });
    expect(serverClient.requestIngest).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Integration — grant reuse (adversarial)
// ---------------------------------------------------------------------------

describe('integration — grant reuse', () => {
  it('returns 202 with failed:true and GRANT_INVALID when grant is already consumed', async () => {
    const serverClient = makeServerClient(CONTROL_SUCCESS, {
      success: false,
      reason: IngestReasonCode.GRANT_INVALID,
      message: 'Grant jti-001 already consumed',
    });
    const handler = createWebhookHandler({
      verifier: makeVerifier(),
      featureFlags: { v2Enabled: true, shadowMode: false },
      serverClient,
      applyTreatment: passthroughTreatment(),
    });
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_PAYLOAD), res);
    expect(getStatus()).toBe(202);
    expect(getBody()).toMatchObject({ failed: true, reason: IngestReasonCode.GRANT_INVALID });
  });
});

// ---------------------------------------------------------------------------
// Integration — cross-tenant insertion prevention (adversarial)
// ---------------------------------------------------------------------------

describe('integration — cross-tenant insertion prevention', () => {
  it('surfaces TENANT_MISMATCH when server rejects cross-tenant ingest', async () => {
    // Server accepts control but rejects ingest because tenant scope does not match.
    const serverClient = makeServerClient(CONTROL_SUCCESS, {
      success: true,
      outcome: 'REJECTED',
      ingestId: null,
      existingIngestId: null,
      auditId: 'audit-reject-001',
      reasonCode: 'TENANT_MISMATCH',
    });
    const handler = createWebhookHandler({
      verifier: makeVerifier(),
      featureFlags: { v2Enabled: true, shadowMode: false },
      serverClient,
      applyTreatment: passthroughTreatment(),
    });
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_PAYLOAD), res);
    expect(getStatus()).toBe(202);
    // outcome REJECTED is a success-path result — the server handled it correctly
    expect(getBody()).toMatchObject({ status: 'accepted', outcome: 'REJECTED', reasonCode: 'TENANT_MISMATCH' });
  });
});

// ---------------------------------------------------------------------------
// Integration — shadow mode
// ---------------------------------------------------------------------------

describe('integration — shadow mode', () => {
  it('returns 202 with shadow:true immediately without awaiting orchestration', async () => {
    let resolveIngest!: (v: IngestResult) => void;
    const ingestPromise = new Promise<IngestResult>(r => { resolveIngest = r; });
    const serverClient = {
      requestControl: vi.fn().mockResolvedValue(CONTROL_SUCCESS),
      requestIngest: vi.fn().mockReturnValue(ingestPromise),
    };
    const handler = createWebhookHandler({
      verifier: makeVerifier(),
      featureFlags: { v2Enabled: true, shadowMode: true },
      serverClient,
    });
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_PAYLOAD), res);

    // Response is sent before orchestration completes
    expect(getStatus()).toBe(202);
    expect(getBody()).toMatchObject({ status: 'accepted', shadow: true });

    // Resolve the ingest promise to avoid dangling promise warnings
    resolveIngest({ success: true, outcome: 'INSERTED', ingestId: 'i1', existingIngestId: null, auditId: 'a1', reasonCode: null });
    await ingestPromise;
  });

  it('still returns 202 in shadow mode even when orchestration fails', async () => {
    const serverClient = {
      requestControl: vi.fn().mockResolvedValue({
        success: false,
        reason: IngestReasonCode.UNKNOWN_ALIAS,
        message: 'not found',
      } as ControlResult),
      requestIngest: vi.fn(),
    };
    const handler = createWebhookHandler({
      verifier: makeVerifier(),
      featureFlags: { v2Enabled: true, shadowMode: true },
      serverClient,
    });
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_PAYLOAD), res);
    expect(getStatus()).toBe(202);
    expect(getBody()).toMatchObject({ status: 'accepted', shadow: true });
    // orchestration failure is not surfaced to Cloudflare
    expect((getBody() as Record<string, unknown>)['failed']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Integration — feature flag disabled
// ---------------------------------------------------------------------------

describe('integration — feature flag', () => {
  it('returns 503 when v2 is disabled regardless of auth', async () => {
    const handler = createWebhookHandler({
      verifier: makeVerifier(),
      featureFlags: { v2Enabled: false, shadowMode: false },
    });
    const { res, getStatus } = makeRes();
    await handler(makeReq(VALID_PAYLOAD), res);
    expect(getStatus()).toBe(503);
  });
});
