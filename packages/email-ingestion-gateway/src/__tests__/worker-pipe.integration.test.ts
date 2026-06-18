import { Blob } from 'node:buffer';
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

function makeEmailMessage(overrides: Partial<EmailMessageLike> = {}): EmailMessageLike {
  const rawMime = [
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
    raw: new Blob([rawMime]).stream(),
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
    };

    const { default: worker } = await import('../worker.js');
    const message = makeEmailMessage();

    await worker.email(message, workerEnv);

    expect(message.forward).not.toHaveBeenCalled();
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
        idempotencyKey: '<worker-test-001@example.com>',
        extractedDocuments: [],
      },
    });

    const ingestInput = ingestRequest?.body.variables?.input as Record<string, unknown>;
    expect(ingestInput.rawMessageHash).toBe(controlInput.rawMessageHash);
    expect(ingestInput.correlationId).toBe(controlInput.correlationId);
  });

  it('falls back to forwarding when the gateway is unreachable', async () => {
    const { default: worker } = await import('../worker.js');
    const message = makeEmailMessage();

    await worker.email(message, {
      CF_WEBHOOK_SECRET: 'worker-shared-secret',
      GATEWAY_URL: 'http://127.0.0.1:9',
      FALLBACK_EMAIL: 'fallback@example.com',
    });

    expect(message.forward).toHaveBeenCalledWith('fallback@example.com');
  });
});