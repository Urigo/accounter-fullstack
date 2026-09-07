import { Blob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

type CapturedGraphqlRequest = {
  headers: Record<string, string | string[] | undefined>;
  body: {
    query: string;
    variables?: Record<string, unknown>;
  };
};

type ForwardMock = ReturnType<typeof vi.fn> & ((recipient: string) => Promise<unknown>);

type EmailMessageLike = {
  to: string;
  headers: Headers;
  raw: ReadableStream;
  forward: ForwardMock;
};

const ORIGINAL_ENV = { ...process.env };
const CONTROL_RESPONSE = {
  data: {
    requestIngestControl: {
      __typename: 'IngestControlDecision',
      id: 'decision-row-001',
      tenantId: 'tenant-001',
      decisionId: 'decision-001',
      auditId: 'audit-control-001',
      grant: {
        id: 'grant-row-001',
        jti: 'grant-jti-001',
        tenantId: 'tenant-001',
        action: 'ingest',
        expiresAt: '2026-06-17T12:05:00.000Z',
      },
      businessEmailConfig: {
        businessId: 'business-001',
        internalEmailLinks: null,
        emailBody: false,
        attachments: null,
      },
    },
  },
};
const INGEST_RESPONSE = {
  data: {
    ingestEmail: {
      __typename: 'IngestEmailSuccess',
      outcome: 'INSERTED',
      ingestId: 'ingest-001',
      existingIngestId: null,
      auditId: 'audit-ingest-001',
      reasonCode: null,
    },
  },
};

// Read as text, not Buffer: the raw MIME goes into a `Blob`, and the fixtures are
// hand-authored ASCII (base64 for any attachment bytes), so there is nothing to lose.
function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

function makeEmailMessage(
  overrides: Partial<EmailMessageLike> = {},
  rawMimeOverride?: string,
): EmailMessageLike {
  const rawMime = rawMimeOverride ?? [
    'Received: from smtp.example.com (127.0.0.1)',
    'by cloudflare-email.com id local-test',
    'for <invoices@acme.example.com>;',
    'From: sender@example.com',
    'To: invoices@acme.example.com',
    'Subject: Worker Integration Test',
    'Date: Tue, 17 Jun 2026 12:00:00 +0000',
    'Message-ID: <worker-test-001@example.com>',
    'Content-Type: text/plain; charset="utf-8"',
    '',
    'hello from the worker integration test',
  ].join('\r\n');

  const forward = vi.fn().mockResolvedValue(undefined) as ForwardMock;

  return {
    to: 'invoices@acme.example.com',
    headers: new Headers({ 'message-id': '<worker-test-001@example.com>' }),
    raw: new Blob([rawMime]).stream() as unknown as ReadableStream,
    forward,
    ...overrides,
  };
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo | null;
      if (!address) {
        reject(new Error('Server address unavailable'));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function createMockGraphqlServer(captured: CapturedGraphqlRequest[]): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST' || req.url !== '/graphql') {
      res.writeHead(404);
      res.end();
      return;
    }

    const body = (await readJson(req)) as CapturedGraphqlRequest['body'];
    captured.push({ headers: req.headers, body });

    const responseBody = body.query.includes('requestIngestControl')
      ? CONTROL_RESPONSE
      : body.query.includes('ingestEmail')
        ? INGEST_RESPONSE
        : { errors: [{ message: 'Unexpected operation' }] };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseBody));
  });
}

describe('worker -> gateway -> mocked server integration', () => {
  let mockServer: Server | undefined;
  let gatewayServer: Server | undefined;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = 'test';
  });

  afterEach(async () => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    if (gatewayServer) {
      await close(gatewayServer);
      gatewayServer = undefined;
    }

    if (mockServer) {
      await close(mockServer);
      mockServer = undefined;
    }
  });

  it('runs the pipe from email reception to control and ingest server requests', async () => {
    const capturedRequests: CapturedGraphqlRequest[] = [];
    mockServer = createMockGraphqlServer(capturedRequests);
    const mockServerUrl = await listen(mockServer);

    process.env.PORT = '3000';
    process.env.EMAIL_INGESTION_V2_ENABLED = '1';
    process.env.EMAIL_INGESTION_SHADOW_MODE = '0';
    process.env.CF_WEBHOOK_SECRET = 'worker-shared-secret';
    process.env.GATEWAY_SERVER_URL = mockServerUrl;
    process.env.GATEWAY_CP_TOKEN = 'gateway-control-plane-token';

    const { requestHandler } = await import('../index.js');
    gatewayServer = createServer(requestHandler);
    const gatewayUrl = await listen(gatewayServer);

    const workerEnv = {
      CF_WEBHOOK_SECRET: 'worker-shared-secret',
      GATEWAY_URL: gatewayUrl,
      FALLBACK_EMAIL: 'fallback@example.com',
      EMAIL_FORWARD_DESTINATION: 'forward@example.com',
    };

    const { default: worker } = await import('../worker.js');
    const message = makeEmailMessage();

    await worker.email(message, workerEnv);

    expect(message.forward).toHaveBeenCalledWith('forward@example.com');
    expect(message.forward).not.toHaveBeenCalledWith('fallback@example.com');
    expect(capturedRequests).toHaveLength(2);

    const [controlRequest, ingestRequest] = capturedRequests;
    expect(controlRequest?.headers['x-gateway-cp-token']).toBe('gateway-control-plane-token');
    expect(controlRequest?.body.query).toContain('requestIngestControl');
    expect(controlRequest?.body.variables).toMatchObject({
      input: {
        recipientAlias: 'invoices@acme.example.com',
        messageId: '<worker-test-001@example.com>',
      },
    });

    const controlInput = controlRequest?.body.variables?.input as Record<string, unknown>;
    expect(typeof controlInput.rawMessageHash).toBe('string');
    expect((controlInput.rawMessageHash as string)).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof controlInput.correlationId).toBe('string');

    expect(ingestRequest?.headers['x-gateway-cp-token']).toBe('gateway-control-plane-token');
    expect(ingestRequest?.body.query).toContain('ingestEmail');
    expect(ingestRequest?.body.variables).toMatchObject({
      input: {
        grantJti: 'grant-jti-001',
        tenantId: 'tenant-001',
        messageId: '<worker-test-001@example.com>',
        extractedDocuments: [],
      },
    });

    const ingestInput = ingestRequest?.body.variables?.input as Record<string, unknown>;
    expect(ingestInput.rawMessageHash).toBe(controlInput.rawMessageHash);
    // Idempotency is keyed on the content-derived hash, not the sender's Message-ID.
    expect(ingestInput.idempotencyKey).toBe(controlInput.rawMessageHash);
    expect(ingestInput.correlationId).toBe(controlInput.correlationId);
  });

  // #4346: the whole point of the Worker's `if (!response.ok)` branch. Before the
  // fix the gateway answered 202 on orchestration failure, `202` satisfied
  // `response.ok`, and the fallback was unreachable for every failure — five
  // emails were permanently lost that way (#4344).
  it('forwards to FALLBACK_EMAIL when orchestration fails with no durable record', async () => {
    // The mock server answers control with a GraphQL error — the exact signature
    // a server-side exception produces through yoga.
    mockServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      await readJson(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ errors: [{ message: 'Failed to process ingest control request' }], data: null }),
      );
    });
    const mockServerUrl = await listen(mockServer);

    process.env.PORT = '3000';
    process.env.EMAIL_INGESTION_V2_ENABLED = '1';
    process.env.EMAIL_INGESTION_SHADOW_MODE = '0';
    process.env.CF_WEBHOOK_SECRET = 'worker-shared-secret';
    process.env.GATEWAY_SERVER_URL = mockServerUrl;
    process.env.GATEWAY_CP_TOKEN = 'gateway-control-plane-token';

    const { requestHandler } = await import('../index.js');
    gatewayServer = createServer(requestHandler);
    const gatewayUrl = await listen(gatewayServer);

    const { default: worker } = await import('../worker.js');
    const message = makeEmailMessage();

    await worker.email(message, {
      CF_WEBHOOK_SECRET: 'worker-shared-secret',
      GATEWAY_URL: gatewayUrl,
      FALLBACK_EMAIL: 'fallback@example.com',
      EMAIL_FORWARD_DESTINATION: 'forward@example.com',
    });

    // No email lost: it reached a human even though nothing was recorded server-side.
    expect(message.forward).toHaveBeenCalledWith('fallback@example.com');
  });

  // The input-shape half of the wire contract, asserted on the bytes that actually
  // leave the Worker. The gateway used to send `forwardedBlocks[].date`, which
  // `ForwardedBlockInput` does not define, so GraphQL answered 400 for every
  // forwarded email whose quoted block carried a `Date:` line. `toMatchObject` (used
  // by the happy-path case above, correctly, to assert *presence*) cannot see an
  // extra key — so this pins the key set with `toEqual` plus an explicit check.
  it('sends only the senderEvidence fields the server SDL defines', async () => {
    const capturedRequests: CapturedGraphqlRequest[] = [];
    mockServer = createMockGraphqlServer(capturedRequests);
    const mockServerUrl = await listen(mockServer);

    process.env.PORT = '3000';
    process.env.EMAIL_INGESTION_V2_ENABLED = '1';
    process.env.EMAIL_INGESTION_SHADOW_MODE = '0';
    process.env.CF_WEBHOOK_SECRET = 'worker-shared-secret';
    process.env.GATEWAY_SERVER_URL = mockServerUrl;
    process.env.GATEWAY_CP_TOKEN = 'gateway-control-plane-token';

    const { requestHandler } = await import('../index.js');
    gatewayServer = createServer(requestHandler);
    const gatewayUrl = await listen(gatewayServer);

    const { default: worker } = await import('../worker.js');
    // Two nested quoted blocks, both carrying a `Date:` line — the exact production
    // shape that produced the 400.
    const message = makeEmailMessage({}, fixture('forwarded-nested-provider.eml'));

    await worker.email(message, {
      CF_WEBHOOK_SECRET: 'worker-shared-secret',
      GATEWAY_URL: gatewayUrl,
      FALLBACK_EMAIL: 'fallback@example.com',
      EMAIL_FORWARD_DESTINATION: 'forward@example.com',
    });

    const controlInput = capturedRequests[0]?.body.variables?.input as Record<string, unknown>;
    const evidence = controlInput.senderEvidence as {
      forwardedBlocks: Array<Record<string, unknown>>;
    };

    expect(evidence.forwardedBlocks.length).toBeGreaterThan(0);
    // The assertion runs on the JSON-parsed request body, where `JSON.stringify` has
    // already dropped undefined-valued keys — so this is a true key-set assertion.
    const allowed = ['from', 'fromDisplayName', 'subject', 'to'];
    for (const block of evidence.forwardedBlocks) {
      expect(Object.keys(block).sort()).toEqual(
        Object.keys(block)
          .filter(key => allowed.includes(key))
          .sort(),
      );
      expect(Object.keys(block)).not.toContain('date');
    }
  });

  // A gateway rejection must never become a Cloudflare redelivery once a copy of the
  // message has been forwarded: Email Routing reads an unhandled exception as a
  // temporary delivery failure and retries with growing backoff, so a *permanent*
  // rejection loops forever. Three messages went through 4-5 redeliveries across
  // 12 hours that way.
  describe('gateway rejection must not escalate into a redelivery loop', () => {
    async function startRejectingGateway(): Promise<string> {
      mockServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        await readJson(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            errors: [{ message: 'Field "date" is not defined by type "ForwardedBlockInput".' }],
            data: null,
          }),
        );
      });
      const mockServerUrl = await listen(mockServer);

      process.env.PORT = '3000';
      process.env.EMAIL_INGESTION_V2_ENABLED = '1';
      process.env.EMAIL_INGESTION_SHADOW_MODE = '0';
      process.env.CF_WEBHOOK_SECRET = 'worker-shared-secret';
      process.env.GATEWAY_SERVER_URL = mockServerUrl;
      process.env.GATEWAY_CP_TOKEN = 'gateway-control-plane-token';

      const { requestHandler } = await import('../index.js');
      gatewayServer = createServer(requestHandler);
      return listen(gatewayServer);
    }

    it('resolves rather than throwing when the message was already forwarded', async () => {
      const gatewayUrl = await startRejectingGateway();
      const { default: worker } = await import('../worker.js');
      const message = makeEmailMessage();

      await expect(
        worker.email(message, {
          CF_WEBHOOK_SECRET: 'worker-shared-secret',
          GATEWAY_URL: gatewayUrl,
          FALLBACK_EMAIL: 'fallback@example.com',
          EMAIL_FORWARD_DESTINATION: 'forward@example.com',
        }),
      ).resolves.toBeUndefined();

      expect(message.forward).toHaveBeenCalledWith('forward@example.com');
      expect(message.forward).toHaveBeenCalledWith('fallback@example.com');
    });

    it('forwards once when FALLBACK_EMAIL equals EMAIL_FORWARD_DESTINATION', async () => {
      const gatewayUrl = await startRejectingGateway();
      const { default: worker } = await import('../worker.js');
      const message = makeEmailMessage();

      // The Workers runtime rejects a second forward to an address already used for
      // the message, and that rejection used to propagate out of the handler.
      await expect(
        worker.email(message, {
          CF_WEBHOOK_SECRET: 'worker-shared-secret',
          GATEWAY_URL: gatewayUrl,
          FALLBACK_EMAIL: 'legacy@example.com',
          EMAIL_FORWARD_DESTINATION: 'Legacy@Example.com ',
        }),
      ).resolves.toBeUndefined();

      expect(message.forward).toHaveBeenCalledTimes(1);
    });

    it('resolves when the runtime rejects the fallback forward', async () => {
      const gatewayUrl = await startRejectingGateway();
      const { default: worker } = await import('../worker.js');
      const message = makeEmailMessage();
      (message.forward as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('destination address already forwarded'));

      await expect(
        worker.email(message, {
          CF_WEBHOOK_SECRET: 'worker-shared-secret',
          GATEWAY_URL: gatewayUrl,
          FALLBACK_EMAIL: 'fallback@example.com',
          EMAIL_FORWARD_DESTINATION: 'forward@example.com',
        }),
      ).resolves.toBeUndefined();
    });

    it('throws only when no copy of the message was delivered', async () => {
      const gatewayUrl = await startRejectingGateway();
      const { default: worker } = await import('../worker.js');
      const message = makeEmailMessage();
      (message.forward as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('forwarding is not configured for this address'),
      );

      // Nothing reached a human and control never granted, so nothing was recorded
      // server-side either — the one case where a redelivery beats dropping the mail.
      await expect(
        worker.email(message, {
          CF_WEBHOOK_SECRET: 'worker-shared-secret',
          GATEWAY_URL: gatewayUrl,
          EMAIL_FORWARD_DESTINATION: 'forward@example.com',
        }),
      ).rejects.toThrow(/no copy of the message was delivered/);
    });
  });

  it('treats a hanging /health as unreachable instead of hanging the handler', async () => {
    // An unbounded probe outlives the Worker's wall clock, and that exception is a
    // redelivery-loop source of its own. The probe is bounded, so this falls back.
    const neverAnswers = createServer(() => {
      /* deliberately never responds */
    });
    gatewayServer = neverAnswers;
    const gatewayUrl = await listen(neverAnswers);

    const { default: worker } = await import('../worker.js');
    const message = makeEmailMessage();

    await worker.email(message, {
      CF_WEBHOOK_SECRET: 'worker-shared-secret',
      GATEWAY_URL: gatewayUrl,
      FALLBACK_EMAIL: 'fallback@example.com',
      EMAIL_FORWARD_DESTINATION: 'forward@example.com',
    });

    expect(message.forward).toHaveBeenCalledWith('fallback@example.com');
  }, 20_000);

  it('falls back to forwarding when the gateway is unreachable', async () => {
    const { default: worker } = await import('../worker.js');
    const message = makeEmailMessage();

    await worker.email(message, {
      CF_WEBHOOK_SECRET: 'worker-shared-secret',
      GATEWAY_URL: 'http://127.0.0.1:9',
      FALLBACK_EMAIL: 'fallback@example.com',
      EMAIL_FORWARD_DESTINATION: 'forward@example.com',
    });

    expect(message.forward).toHaveBeenCalledWith('fallback@example.com');
  });
});