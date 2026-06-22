import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { IngestReasonCode } from '../contracts.js';
import { createWebhookHandler } from '../webhook.js';
import type { AuthenticityVerdict, CloudflareAuthenticityVerifier } from '../verifier.js';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TIMESTAMP = String(1_700_000_000);

// The request body is now the raw MIME message; routing metadata (recipient
// alias, message id) travels in headers.
const VALID_BODY = [
  'From: sender@example.com',
  'To: invoices@acme.example.com',
  'Subject: Test',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'See attached.',
].join('\r\n');

function makeVerifier(verdict: AuthenticityVerdict = { valid: true }) {
  return {
    verify: vi.fn().mockResolvedValue(verdict),
  } as unknown as CloudflareAuthenticityVerifier;
}

function makeReq(
  body: string | Buffer = VALID_BODY,
  headerOverrides: Record<string, string | undefined> = {},
): IncomingMessage {
  const stream = new PassThrough();
  stream.end(body);

  const headers: Record<string, string> = {
    'x-cf-timestamp': VALID_TIMESTAMP,
    'x-cf-signature': 'a'.repeat(64),
    'x-cf-nonce': 'unique-nonce-abc',
    'x-cf-recipient': 'invoices@acme.example.com',
    'x-cf-message-id': '<abc123@mail.example.com>',
  };
  for (const [k, v] of Object.entries(headerOverrides)) {
    if (v === undefined) {
      delete headers[k];
    } else {
      headers[k] = v;
    }
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
  } as unknown as ServerResponse;
  return {
    res,
    getStatus: () => status,
    getBody: () => (body ? (JSON.parse(body) as Record<string, unknown>) : undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /webhook — createWebhookHandler', () => {
  let handler: ReturnType<typeof createWebhookHandler>;
  let verifier: CloudflareAuthenticityVerifier;

  beforeEach(() => {
    verifier = makeVerifier({ valid: true });
    handler = createWebhookHandler({ verifier, featureFlags: { v2Enabled: true, shadowMode: false } });
  });

  // -------------------------------------------------------------------------
  // Feature-flag gating
  // -------------------------------------------------------------------------

  it('returns 503 when v2 is disabled', async () => {
    const disabledHandler = createWebhookHandler({
      verifier,
      featureFlags: { v2Enabled: false, shadowMode: false },
    });
    const { res, getStatus, getBody } = makeRes();
    await disabledHandler(makeReq(), res);
    expect(getStatus()).toBe(503);
    expect(getBody()).toMatchObject({ error: 'Service unavailable' });
  });

  // -------------------------------------------------------------------------
  // Header validation
  // -------------------------------------------------------------------------

  it('returns 400 when x-cf-timestamp is missing', async () => {
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_BODY, { 'x-cf-timestamp': undefined }), res);
    expect(getStatus()).toBe(400);
    expect(getBody()).toMatchObject({ error: 'Bad request' });
  });

  it('returns 400 when x-cf-signature is missing', async () => {
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_BODY, { 'x-cf-signature': undefined }), res);
    expect(getStatus()).toBe(400);
    expect(getBody()).toMatchObject({ error: 'Bad request' });
  });

  it('returns 400 when x-cf-nonce is missing', async () => {
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_BODY, { 'x-cf-nonce': undefined }), res);
    expect(getStatus()).toBe(400);
    expect(getBody()).toMatchObject({ error: 'Bad request' });
  });

  it('returns 400 when x-cf-timestamp is not a numeric string', async () => {
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_BODY, { 'x-cf-timestamp': 'not-a-number' }), res);
    expect(getStatus()).toBe(400);
    expect(getBody()).toMatchObject({ error: 'Bad request' });
  });

  // -------------------------------------------------------------------------
  // Authenticity check failures
  // -------------------------------------------------------------------------

  it('returns 401 with INVALID_AUTH when the verifier rejects the request', async () => {
    const h = createWebhookHandler({
      verifier: makeVerifier({ valid: false, reason: IngestReasonCode.INVALID_AUTH }),
      featureFlags: { v2Enabled: true, shadowMode: false },
    });
    const { res, getStatus, getBody } = makeRes();
    await h(makeReq(), res);
    expect(getStatus()).toBe(401);
    expect(getBody()).toMatchObject({
      error: 'Unauthorized',
      reason: IngestReasonCode.INVALID_AUTH,
    });
  });

  it('returns 401 with REPLAY_DETECTED on nonce replay', async () => {
    const h = createWebhookHandler({
      verifier: makeVerifier({ valid: false, reason: IngestReasonCode.REPLAY_DETECTED }),
      featureFlags: { v2Enabled: true, shadowMode: false },
    });
    const { res, getStatus, getBody } = makeRes();
    await h(makeReq(), res);
    expect(getStatus()).toBe(401);
    expect(getBody()).toMatchObject({ reason: IngestReasonCode.REPLAY_DETECTED });
  });

  // -------------------------------------------------------------------------
  // Metadata header validation
  // -------------------------------------------------------------------------

  it('returns 400 when x-cf-recipient is missing', async () => {
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_BODY, { 'x-cf-recipient': undefined }), res);
    expect(getStatus()).toBe(400);
    expect(getBody()).toMatchObject({ error: 'Bad request' });
  });

  it('returns 400 when x-cf-message-id is missing', async () => {
    const { res, getStatus } = makeRes();
    await handler(makeReq(VALID_BODY, { 'x-cf-message-id': undefined }), res);
    expect(getStatus()).toBe(400);
  });

  it('does not call the verifier when a metadata header is missing', async () => {
    const mockVerifier = makeVerifier({ valid: true });
    const h = createWebhookHandler({
      verifier: mockVerifier,
      featureFlags: { v2Enabled: true, shadowMode: false },
    });
    const { res } = makeRes();
    await h(makeReq(VALID_BODY, { 'x-cf-recipient': undefined }), res);
    expect(mockVerifier.verify).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------

  it('returns 202 with { status: "accepted", correlationId } on a valid request', async () => {
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(), res);
    expect(getStatus()).toBe(202);
    const body = getBody();
    expect(body).toMatchObject({ status: 'accepted' });
    expect(typeof (body as { correlationId: string }).correlationId).toBe('string');
    expect((body as { correlationId: string }).correlationId.length).toBeGreaterThan(0);
  });

  it('uses the correlationId from the x-correlation-id header when present', async () => {
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(VALID_BODY, { 'x-correlation-id': 'client-corr-id' }), res);
    expect(getStatus()).toBe(202);
    expect((getBody() as { correlationId: string }).correlationId).toBe('client-corr-id');
  });

  it('calls the verifier with the raw body bytes and header values', async () => {
    const mockVerifier = makeVerifier({ valid: true });
    const h = createWebhookHandler({ verifier: mockVerifier, featureFlags: { v2Enabled: true, shadowMode: false } });
    const { res } = makeRes();
    await h(makeReq(), res);

    expect(mockVerifier.verify).toHaveBeenCalledOnce();
    const arg = (mockVerifier.verify as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Parameters<CloudflareAuthenticityVerifier['verify']>[0];
    expect(arg.signature).toBe('a'.repeat(64));
    expect(arg.nonce).toBe('unique-nonce-abc');
    expect(arg.timestampSeconds).toBe(1_700_000_000);
    expect(Buffer.isBuffer(arg.rawBody)).toBe(true);
    expect((arg.rawBody as Buffer).toString()).toBe(VALID_BODY);
  });

  it('does not call the verifier when a required header is missing', async () => {
    const mockVerifier = makeVerifier({ valid: true });
    const h = createWebhookHandler({ verifier: mockVerifier, featureFlags: { v2Enabled: true, shadowMode: false } });
    const { res } = makeRes();
    await h(makeReq(VALID_BODY, { 'x-cf-signature': undefined }), res);
    expect(mockVerifier.verify).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Sender evidence forwarding (business recognition)
  // -------------------------------------------------------------------------

  it('forwards extracted senderEvidence to the control endpoint (even with no attachments)', async () => {
    const requestControl = vi.fn().mockResolvedValue({
      success: true,
      decision: {
        id: 'd1',
        tenantId: 't1',
        decisionId: 'dec1',
        auditId: 'a1',
        grant: {
          id: 'g1',
          jti: 'jti-1',
          tenantId: 't1',
          action: 'ingest',
          expiresAt: '2099-01-01T00:00:00Z',
        },
      },
    });
    const serverClient = {
      requestControl,
      requestIngest: vi.fn().mockResolvedValue({
        success: true,
        outcome: 'QUARANTINED',
        ingestId: null,
        existingIngestId: null,
        auditId: 'a2',
        reasonCode: 'NO_DOCUMENTS',
      }),
    };
    const h = createWebhookHandler({
      verifier: makeVerifier({ valid: true }),
      featureFlags: { v2Enabled: true, shadowMode: false },
      serverClient,
    });
    const body = [
      'From: Forwarder <forwarder@gmail.com>',
      'To: invoices@acme.example.com',
      'Reply-To: reply@vendor.com',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'no attachments here',
    ].join('\r\n');

    const { res, getStatus } = makeRes();
    await h(makeReq(body), res);

    expect(getStatus()).toBe(202);
    expect(requestControl).toHaveBeenCalledOnce();
    const controlArg = requestControl.mock.calls[0][0] as { senderEvidence?: Record<string, unknown> };
    expect(controlArg.senderEvidence).toMatchObject({
      from: 'Forwarder <forwarder@gmail.com>',
      replyTo: 'reply@vendor.com',
      issuerCandidates: [],
    });
  });

  // -------------------------------------------------------------------------
  // Body read errors
  // -------------------------------------------------------------------------

  it('returns 400 (not 413) when the request stream emits an error', async () => {
    const stream = new PassThrough();
    const req = Object.assign(stream, {
      headers: {
        'x-cf-timestamp': VALID_TIMESTAMP,
        'x-cf-signature': 'a'.repeat(64),
        'x-cf-nonce': 'unique-nonce-abc',
        'x-cf-recipient': 'invoices@acme.example.com',
        'x-cf-message-id': '<abc123@mail.example.com>',
      },
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
    }) as unknown as IncomingMessage;

    // Emit a network error after the handler starts reading
    setImmediate(() => stream.destroy(new Error('ECONNRESET')));

    const { res, getStatus, getBody } = makeRes();
    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getBody()).toMatchObject({ error: 'Bad request' });
  });

  // -------------------------------------------------------------------------
  // Source IP resolution
  // -------------------------------------------------------------------------

  it('passes cf-connecting-ip as sourceIp when present', async () => {
    const mockVerifier = makeVerifier({ valid: true });
    const h = createWebhookHandler({ verifier: mockVerifier, featureFlags: { v2Enabled: true, shadowMode: false } });
    const req = makeReq(VALID_BODY, { 'cf-connecting-ip': '198.41.128.5' });
    const { res } = makeRes();
    await h(req, res);

    const arg = (mockVerifier.verify as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Parameters<CloudflareAuthenticityVerifier['verify']>[0];
    expect(arg.sourceIp).toBe('198.41.128.5');
  });

  it('strips ::ffff: prefix from IPv4-mapped IPv6 addresses', async () => {
    const mockVerifier = makeVerifier({ valid: true });
    const h = createWebhookHandler({ verifier: mockVerifier, featureFlags: { v2Enabled: true, shadowMode: false } });
    const stream = new PassThrough();
    stream.end(VALID_BODY);
    const req = Object.assign(stream, {
      headers: {
        'x-cf-timestamp': VALID_TIMESTAMP,
        'x-cf-signature': 'a'.repeat(64),
        'x-cf-nonce': 'unique-nonce-abc',
        'x-cf-recipient': 'invoices@acme.example.com',
        'x-cf-message-id': '<abc123@mail.example.com>',
      },
      method: 'POST',
      socket: { remoteAddress: '::ffff:192.168.1.1' },
    }) as unknown as IncomingMessage;

    const { res } = makeRes();
    await h(req, res);

    const arg = (mockVerifier.verify as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Parameters<CloudflareAuthenticityVerifier['verify']>[0];
    expect(arg.sourceIp).toBe('192.168.1.1');
  });
});

// ---------------------------------------------------------------------------
// Shadow mode
// ---------------------------------------------------------------------------

describe('POST /webhook — shadow mode', () => {
  it('returns 202 with shadow:true and does not await orchestration', async () => {
    const verifier = makeVerifier({ valid: true });
    let resolveIngest!: () => void;
    const hangingPromise = new Promise<never>((_res, _rej) => {
      resolveIngest = () => _rej(new Error('test cleanup'));
    });
    const serverClient = {
      requestControl: vi.fn().mockResolvedValue({
        success: true,
        decision: {
          id: 'd1',
          tenantId: 't1',
          decisionId: 'dec1',
          auditId: 'a1',
          grant: { id: 'g1', jti: 'jti-1', tenantId: 't1', action: 'ingest', expiresAt: '2099-01-01T00:00:00Z' },
        },
      }),
      requestIngest: vi.fn().mockReturnValue(hangingPromise),
    };
    const handler = createWebhookHandler({
      verifier,
      featureFlags: { v2Enabled: true, shadowMode: true },
      serverClient,
    });
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(), res);

    // Handler returned without waiting for the hanging ingest promise
    expect(getStatus()).toBe(202);
    expect(getBody()).toMatchObject({ status: 'accepted', shadow: true });

    // Cleanup: reject and await so no dangling promise warning from vitest
    resolveIngest();
    await expect(hangingPromise).rejects.toThrow('test cleanup');
  });

  it('returns 202 in shadow mode even when orchestration fails', async () => {
    const verifier = makeVerifier({ valid: true });
    const serverClient = {
      requestControl: vi.fn().mockResolvedValue({
        success: false,
        reason: 'UNKNOWN_ALIAS',
        message: 'not found',
      }),
      requestIngest: vi.fn(),
    };
    const handler = createWebhookHandler({
      verifier,
      featureFlags: { v2Enabled: true, shadowMode: true },
      serverClient,
    });
    const { res, getStatus, getBody } = makeRes();
    await handler(makeReq(), res);
    expect(getStatus()).toBe(202);
    expect(getBody()).toMatchObject({ shadow: true });
    expect((getBody() as Record<string, unknown>)['failed']).toBeUndefined();
  });
});
