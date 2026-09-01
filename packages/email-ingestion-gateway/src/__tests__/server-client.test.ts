import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IngestReasonCode } from '../contracts.js';
import {
  CONTROL_TIMEOUT_MS,
  CONTROL_MAX_RETRIES,
  CONTROL_BASE_DELAY_MS,
  INGEST_TIMEOUT_MS,
  INGEST_MAX_RETRIES,
  MAX_ERROR_MESSAGE_LENGTH,
  RETRY_JITTER_RATIO,
  ServerClient,
  type ControlInput,
  type IngestInput,
} from '../server-client.js';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://test-server:4000';
const CP_TOKEN = 'test-cp-token';

const CONTROL_INPUT: ControlInput = {
  recipientAlias: 'invoices@acme.example.com',
  messageId: '<msg001@mail.example.com>',
  rawMessageHash: 'a'.repeat(64),
  correlationId: 'corr-abc',
};

const INGEST_INPUT: IngestInput = {
  grantJti: 'jti-001',
  idempotencyKey: 'idem-key-001',
  tenantId: 'tenant-001',
  messageId: '<msg001@mail.example.com>',
  rawMessageHash: 'a'.repeat(64),
  correlationId: 'corr-abc',
  extractedDocuments: [
    { hash: 'b'.repeat(64), sizeBytes: 1024, mimeType: 'application/pdf', filename: 'inv.pdf' },
  ],
};

const CONTROL_SUCCESS_RESPONSE = {
  data: {
    requestIngestControl: {
      __typename: 'IngestControlDecision',
      id: 'dec-001',
      tenantId: 'tenant-001',
      decisionId: 'decision-001',
      auditId: 'audit-001',
      grant: {
        id: 'grant-001',
        jti: 'jti-001',
        tenantId: 'tenant-001',
        action: 'ingest',
        expiresAt: '2026-01-01T00:05:00Z',
      },
      businessEmailConfig: null,
    },
  },
};

const CONTROL_UNKNOWN_ALIAS_RESPONSE = {
  data: {
    requestIngestControl: {
      __typename: 'CommonError',
      message: 'Unknown recipient alias',
    },
  },
};

const INGEST_SUCCESS_RESPONSE = {
  data: {
    ingestEmail: {
      __typename: 'IngestEmailSuccess',
      outcome: 'INSERTED',
      ingestId: 'ingest-001',
      existingIngestId: null,
      auditId: 'audit-002',
      reasonCode: null,
    },
  },
};

const INGEST_DUPLICATE_RESPONSE = {
  data: {
    ingestEmail: {
      __typename: 'IngestEmailSuccess',
      outcome: 'DUPLICATE',
      ingestId: null,
      existingIngestId: 'ingest-001',
      auditId: 'audit-003',
      reasonCode: 'DUPLICATE',
    },
  },
};

const INGEST_QUARANTINED_RESPONSE = {
  data: {
    ingestEmail: {
      __typename: 'IngestEmailSuccess',
      outcome: 'QUARANTINED',
      ingestId: null,
      existingIngestId: null,
      auditId: 'audit-004',
      reasonCode: 'NO_DOCUMENTS',
    },
  },
};

const INGEST_GRANT_INVALID_RESPONSE = {
  data: {
    ingestEmail: {
      __typename: 'CommonError',
      message: 'Grant is invalid or already consumed',
    },
  },
};

function makeFetch(
  responses: Array<{ status?: number; body?: unknown; throws?: Error }>,
): typeof globalThis.fetch {
  let call = 0;
  return vi.fn(async (_url, _opts) => {
    const entry = responses[call++] ?? responses[responses.length - 1];
    if (entry?.throws) throw entry.throws;
    const status = entry?.status ?? 200;
    const body = entry?.body ?? {};
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: async () => JSON.stringify(body),
      json: async () => body,
    } as Response;
  }) as unknown as typeof globalThis.fetch;
}

function makeClient(fetchFn: typeof globalThis.fetch) {
  return new ServerClient({
    serverUrl: BASE_URL,
    cpToken: CP_TOKEN,
    fetch: fetchFn,
    sleep: vi.fn().mockResolvedValue(undefined),
  });
}

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

describe('exported constants', () => {
  it('CONTROL_TIMEOUT_MS is 3000', () => expect(CONTROL_TIMEOUT_MS).toBe(3_000));
  // Widened from 2 (#4347): control is side-effect-free before issueGrant, so the
  // budget can afford to ride out a restart or a cold pool rather than giving up
  // after 300ms of backoff.
  it('CONTROL_MAX_RETRIES is 4', () => expect(CONTROL_MAX_RETRIES).toBe(4));
  it('CONTROL_BASE_DELAY_MS is 250', () => expect(CONTROL_BASE_DELAY_MS).toBe(250));
  // Never widened: a retried ingest burns the single-use grant.
  it('INGEST_TIMEOUT_MS is 30000', () => expect(INGEST_TIMEOUT_MS).toBe(30_000));
  it('INGEST_MAX_RETRIES is 1', () => expect(INGEST_MAX_RETRIES).toBe(1));
});

// ---------------------------------------------------------------------------
// requestControl — success
// ---------------------------------------------------------------------------

describe('ServerClient.requestControl — success', () => {
  it('returns success with decision on 200 IngestControlDecision', async () => {
    const client = makeClient(makeFetch([{ body: CONTROL_SUCCESS_RESPONSE }]));
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.decision.tenantId).toBe('tenant-001');
      expect(result.decision.grant.jti).toBe('jti-001');
    }
  });

  it('sends POST to /graphql with correct headers', async () => {
    const fetchFn = makeFetch([{ body: CONTROL_SUCCESS_RESPONSE }]);
    const client = makeClient(fetchFn);
    await client.requestControl(CONTROL_INPUT);

    const [url, opts] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      URL | string,
      RequestInit,
    ];
    expect(String(url)).toBe(`${BASE_URL}/graphql`);
    expect((opts.headers as Headers).get('Content-Type')).toBe('application/json');
    expect((opts.headers as Headers).get('X-Gateway-CP-Token')).toBe(CP_TOKEN);
  });

  it('sends the correlationId in the request body', async () => {
    const fetchFn = makeFetch([{ body: CONTROL_SUCCESS_RESPONSE }]);
    const client = makeClient(fetchFn);
    await client.requestControl(CONTROL_INPUT);

    const [, opts] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as { variables: { input: ControlInput } };
    expect(body.variables.input.correlationId).toBe('corr-abc');
  });

  it('returns null businessEmailConfig when control reports no recognized business', async () => {
    const client = makeClient(makeFetch([{ body: CONTROL_SUCCESS_RESPONSE }]));
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.decision.businessEmailConfig).toBeNull();
    }
  });

  it('parses the businessEmailConfig from the control decision', async () => {
    const response = {
      data: {
        requestIngestControl: {
          ...CONTROL_SUCCESS_RESPONSE.data.requestIngestControl,
          businessEmailConfig: {
            businessId: 'biz-1',
            internalEmailLinks: ['https://vendor.com/invoices'],
            emailBody: true,
            attachments: ['PDF'],
          },
        },
      },
    };
    const client = makeClient(makeFetch([{ body: response }]));
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.decision.businessEmailConfig).toEqual({
        businessId: 'biz-1',
        internalEmailLinks: ['https://vendor.com/invoices'],
        emailBody: true,
        attachments: ['PDF'],
      });
    }
  });

  it('sends senderEvidence in the request body when provided', async () => {
    const fetchFn = makeFetch([{ body: CONTROL_SUCCESS_RESPONSE }]);
    const client = makeClient(fetchFn);
    await client.requestControl({
      ...CONTROL_INPUT,
      senderEvidence: { from: 'forwarder@gmail.com', issuerCandidates: ['real@vendor.com'] },
    });

    const [, opts] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as { variables: { input: ControlInput } };
    expect(body.variables.input.senderEvidence).toEqual({
      from: 'forwarder@gmail.com',
      issuerCandidates: ['real@vendor.com'],
    });
  });
});

// ---------------------------------------------------------------------------
// requestControl — GraphQL-level errors (errors[] in response body)
// ---------------------------------------------------------------------------

describe('ServerClient.requestControl — GraphQL errors', () => {
  // HTTP 200 + errors[] means the server answered and said no — a server-side
  // exception through yoga. Not transient: labelling it so is what made the
  // #4344 incident read as a passing cloud for two days.
  it('returns UPSTREAM_ERROR when server returns top-level GraphQL errors', async () => {
    const client = makeClient(
      makeFetch([{ body: { errors: [{ message: 'internal server error' }], data: null } }]),
    );
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.UPSTREAM_ERROR);
      // The cause is carried on the failure rather than dropped (#4345).
      expect(result.message).toContain('internal server error');
      expect(result.status).toBe(200);
      expect(result.attempts).toBe(1);
    }
  });

  it('does NOT retry a 200-with-GraphQL-errors response', async () => {
    const fetchFn = makeFetch([
      { body: { errors: [{ message: 'boom' }], data: null } },
      { body: { errors: [{ message: 'boom' }], data: null } },
    ]);
    const client = makeClient(fetchFn);
    await client.requestControl(CONTROL_INPUT);
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('truncates a very long upstream error instead of logging it whole', async () => {
    const client = makeClient(
      makeFetch([{ body: { errors: [{ message: 'x'.repeat(5_000) }], data: null } }]),
    );
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      // The bound is hard: the "… [truncated]" suffix counts toward it.
      expect(result.message.length).toBeLessThanOrEqual(MAX_ERROR_MESSAGE_LENGTH);
      expect(result.message).toContain('truncated');
    }
  });

  it('returns UPSTREAM_ERROR when data is null (no requestIngestControl field)', async () => {
    const client = makeClient(makeFetch([{ body: { data: null } }]));
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.UPSTREAM_ERROR);
    }
  });
});

// ---------------------------------------------------------------------------
// requestControl — UNKNOWN_ALIAS (CommonError from server)
// ---------------------------------------------------------------------------

describe('ServerClient.requestControl — UNKNOWN_ALIAS', () => {
  it('returns UNKNOWN_ALIAS when server returns CommonError', async () => {
    const client = makeClient(makeFetch([{ body: CONTROL_UNKNOWN_ALIAS_RESPONSE }]));
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.UNKNOWN_ALIAS);
    }
  });

  it('does NOT retry on CommonError (alias not found is deterministic)', async () => {
    const fetchFn = makeFetch([
      { body: CONTROL_UNKNOWN_ALIAS_RESPONSE },
      { body: CONTROL_SUCCESS_RESPONSE },
    ]);
    const client = makeClient(fetchFn);
    await client.requestControl(CONTROL_INPUT);
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// requestControl — retry on 5xx
// ---------------------------------------------------------------------------

describe('ServerClient.requestControl — retry on 5xx', () => {
  it('retries on 5xx and succeeds within the budget', async () => {
    const fetchFn = makeFetch([
      { status: 503, body: { error: 'unavailable' } },
      { status: 502, body: { error: 'bad gateway' } },
      { body: CONTROL_SUCCESS_RESPONSE },
    ]);
    const client = makeClient(fetchFn);
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(true);
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
  });

  it('returns TRANSIENT_UPSTREAM when all retries exhausted on 5xx', async () => {
    const fetchFn = makeFetch(
      Array.from({ length: CONTROL_MAX_RETRIES + 1 }, () => ({ status: 503, body: {} })),
    );
    const client = makeClient(fetchFn);
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      // A 5xx is the server failing rather than refusing — still transient.
      expect(result.reason).toBe(IngestReasonCode.TRANSIENT_UPSTREAM);
      expect(result.status).toBe(503);
      expect(result.attempts).toBe(CONTROL_MAX_RETRIES + 1);
    }
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(
      CONTROL_MAX_RETRIES + 1,
    );
  });

  it('does NOT retry on a terminal 4xx, and reports it as UPSTREAM_ERROR', async () => {
    const fetchFn = makeFetch([{ status: 401, body: {} }]);
    const client = makeClient(fetchFn);
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.UPSTREAM_ERROR);
      expect(result.status).toBe(401);
    }
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('DOES retry a 429 (the server asked us to come back)', async () => {
    const fetchFn = makeFetch([{ status: 429, body: {} }, { body: CONTROL_SUCCESS_RESPONSE }]);
    const client = makeClient(fetchFn);
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(true);
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('applies exponential backoff between retries', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchFn = makeFetch([
      { status: 503, body: {} },
      { status: 503, body: {} },
      { body: CONTROL_SUCCESS_RESPONSE },
    ]);
    const client = new ServerClient({
      serverUrl: BASE_URL,
      cpToken: CP_TOKEN,
      fetch: fetchFn,
      sleep,
      random: () => 0, // no jitter, so the exponential shape is exact
    });
    await client.requestControl(CONTROL_INPUT);

    expect(sleep).toHaveBeenCalledTimes(2);
    const [delay1, delay2] = (sleep as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as number,
    );
    expect(delay1).toBe(CONTROL_BASE_DELAY_MS);
    expect(delay2).toBe(CONTROL_BASE_DELAY_MS * 2);
  });

  it('adds jitter on top of the exponential delay so concurrent retries desynchronize', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchFn = makeFetch([{ status: 503, body: {} }, { body: CONTROL_SUCCESS_RESPONSE }]);
    const client = new ServerClient({
      serverUrl: BASE_URL,
      cpToken: CP_TOKEN,
      fetch: fetchFn,
      sleep,
      random: () => 1, // maximum jitter
    });
    await client.requestControl(CONTROL_INPUT);

    const [delay] = (sleep as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as number,
    );
    expect(delay).toBe(Math.round(CONTROL_BASE_DELAY_MS * (1 + RETRY_JITTER_RATIO)));
  });
});

// ---------------------------------------------------------------------------
// requestControl — retry on network error
// ---------------------------------------------------------------------------

describe('ServerClient.requestControl — retry on network error', () => {
  it('retries on fetch network error', async () => {
    const networkError = new TypeError('fetch failed');
    const fetchFn = makeFetch([{ throws: networkError }, { body: CONTROL_SUCCESS_RESPONSE }]);
    const client = makeClient(fetchFn);
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(true);
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('returns TRANSIENT_UPSTREAM when network errors exhaust retries', async () => {
    const networkError = new TypeError('fetch failed');
    const fetchFn = makeFetch([
      { throws: networkError },
      { throws: networkError },
      { throws: networkError },
    ]);
    const client = makeClient(fetchFn);
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.TRANSIENT_UPSTREAM);
    }
  });
});

// ---------------------------------------------------------------------------
// requestControl — timeout
// ---------------------------------------------------------------------------

describe('ServerClient.requestControl — timeout', () => {
  it('returns TIMEOUT when fetch throws TimeoutError', async () => {
    const timeoutError = Object.assign(new DOMException('Timeout', 'TimeoutError'));
    const fetchFn = makeFetch([
      { throws: timeoutError },
      { throws: timeoutError },
      { throws: timeoutError },
    ]);
    const client = makeClient(fetchFn);
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.TIMEOUT);
    }
  });

  it('DOES retry control on timeout (no single-use grant to burn)', async () => {
    const timeoutError = Object.assign(new DOMException('Timeout', 'TimeoutError'));
    const fetchFn = makeFetch([{ throws: timeoutError }, { body: CONTROL_SUCCESS_RESPONSE }]);
    const client = makeClient(fetchFn);
    const result = await client.requestControl(CONTROL_INPUT);
    expect(result.success).toBe(true);
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2); // 1 + 1 retry
  });
});

// ---------------------------------------------------------------------------
// requestIngest — GraphQL-level errors
// ---------------------------------------------------------------------------

describe('ServerClient.requestIngest — GraphQL errors', () => {
  it('returns UPSTREAM_ERROR when server returns top-level GraphQL errors', async () => {
    const client = makeClient(
      makeFetch([{ body: { errors: [{ message: 'schema error' }], data: null } }]),
    );
    const result = await client.requestIngest(INGEST_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.UPSTREAM_ERROR);
      expect(result.message).toContain('schema error');
    }
  });

  it('returns UPSTREAM_ERROR when data is null (no ingestEmail field)', async () => {
    const client = makeClient(makeFetch([{ body: { data: null } }]));
    const result = await client.requestIngest(INGEST_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.UPSTREAM_ERROR);
    }
  });
});

// ---------------------------------------------------------------------------
// requestIngest — success outcomes
// ---------------------------------------------------------------------------

describe('ServerClient.requestIngest — outcome mapping', () => {
  it('maps INSERTED outcome correctly', async () => {
    const client = makeClient(makeFetch([{ body: INGEST_SUCCESS_RESPONSE }]));
    const result = await client.requestIngest(INGEST_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outcome).toBe('INSERTED');
      expect(result.ingestId).toBe('ingest-001');
      expect(result.auditId).toBe('audit-002');
    }
  });

  it('maps DUPLICATE outcome correctly', async () => {
    const client = makeClient(makeFetch([{ body: INGEST_DUPLICATE_RESPONSE }]));
    const result = await client.requestIngest(INGEST_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outcome).toBe('DUPLICATE');
      expect(result.existingIngestId).toBe('ingest-001');
    }
  });

  it('maps QUARANTINED outcome correctly', async () => {
    const client = makeClient(makeFetch([{ body: INGEST_QUARANTINED_RESPONSE }]));
    const result = await client.requestIngest(INGEST_INPUT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outcome).toBe('QUARANTINED');
      expect(result.reasonCode).toBe('NO_DOCUMENTS');
    }
  });

  it('returns GRANT_INVALID when server returns CommonError for ingest', async () => {
    const client = makeClient(makeFetch([{ body: INGEST_GRANT_INVALID_RESPONSE }]));
    const result = await client.requestIngest(INGEST_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.GRANT_INVALID);
    }
  });
});

// ---------------------------------------------------------------------------
// requestIngest — retry policy (1 retry max for network/5xx)
// ---------------------------------------------------------------------------

describe('ServerClient.requestIngest — retry policy', () => {
  it('retries once on 5xx then succeeds', async () => {
    const fetchFn = makeFetch([
      { status: 503, body: {} },
      { body: INGEST_SUCCESS_RESPONSE },
    ]);
    const client = makeClient(fetchFn);
    const result = await client.requestIngest(INGEST_INPUT);
    expect(result.success).toBe(true);
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('returns TRANSIENT_UPSTREAM when 5xx exhausts 1 retry', async () => {
    const fetchFn = makeFetch([{ status: 503, body: {} }, { status: 503, body: {} }]);
    const client = makeClient(fetchFn);
    const result = await client.requestIngest(INGEST_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.TRANSIENT_UPSTREAM);
    }
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2); // 1 + 1 retry
  });

  it('does NOT retry ingest on 4xx', async () => {
    const fetchFn = makeFetch([{ status: 401, body: {} }]);
    const client = makeClient(fetchFn);
    const result = await client.requestIngest(INGEST_INPUT);
    expect(result.success).toBe(false);
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('retries once on network error then succeeds', async () => {
    const fetchFn = makeFetch([
      { throws: new TypeError('fetch failed') },
      { body: INGEST_SUCCESS_RESPONSE },
    ]);
    const client = makeClient(fetchFn);
    const result = await client.requestIngest(INGEST_INPUT);
    expect(result.success).toBe(true);
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('returns TIMEOUT and does NOT retry ingest on timeout (would burn the single-use grant)', async () => {
    const timeoutError = Object.assign(new DOMException('Timeout', 'TimeoutError'));
    // Second response would succeed — it must never be reached, proving no retry.
    const fetchFn = makeFetch([{ throws: timeoutError }, { body: INGEST_SUCCESS_RESPONSE }]);
    const client = makeClient(fetchFn);
    const result = await client.requestIngest(INGEST_INPUT);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe(IngestReasonCode.TIMEOUT);
    }
    expect((fetchFn as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1); // no retry on timeout
  });
});

// ---------------------------------------------------------------------------
// requestIngest — sends correct payload
// ---------------------------------------------------------------------------

describe('ServerClient.requestIngest — payload', () => {
  it('sends grantJti, idempotencyKey, tenantId, and extractedDocuments', async () => {
    const fetchFn = makeFetch([{ body: INGEST_SUCCESS_RESPONSE }]);
    const client = makeClient(fetchFn);
    await client.requestIngest(INGEST_INPUT);

    const [, opts] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as { variables: { input: IngestInput } };
    expect(body.variables.input.grantJti).toBe('jti-001');
    expect(body.variables.input.idempotencyKey).toBe('idem-key-001');
    expect(body.variables.input.tenantId).toBe('tenant-001');
    expect(body.variables.input.extractedDocuments).toHaveLength(1);
  });
});
