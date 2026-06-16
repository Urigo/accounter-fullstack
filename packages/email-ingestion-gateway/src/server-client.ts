import { IngestReasonCode } from './contracts.js';

// ---------------------------------------------------------------------------
// Exported policy constants
// ---------------------------------------------------------------------------

export const CONTROL_TIMEOUT_MS = 3000;
export const CONTROL_MAX_RETRIES = 2;
export const INGEST_TIMEOUT_MS = 10_000;
export const INGEST_MAX_RETRIES = 1;

// ---------------------------------------------------------------------------
// GraphQL operation strings
// ---------------------------------------------------------------------------

const REQUEST_INGEST_CONTROL_MUTATION = `
  mutation RequestIngestControl($input: IngestControlInput!) {
    requestIngestControl(input: $input) {
      __typename
      ... on IngestControlDecision {
        id
        tenantId
        decisionId
        auditId
        grant {
          id
          jti
          tenantId
          action
          expiresAt
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

const INGEST_EMAIL_MUTATION = `
  mutation IngestEmail($input: IngestEmailInput!) {
    ingestEmail(input: $input) {
      __typename
      ... on IngestEmailSuccess {
        outcome
        ingestId
        existingIngestId
        auditId
        reasonCode
      }
      ... on CommonError {
        message
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface ControlInput {
  recipientAlias: string;
  messageId: string;
  rawMessageHash: string;
  receivedAt?: string;
  correlationId?: string;
}

export interface GrantData {
  id: string;
  jti: string;
  tenantId: string;
  action: string;
  expiresAt: string;
}

export interface ControlDecision {
  id: string;
  tenantId: string;
  decisionId: string;
  auditId: string;
  grant: GrantData;
}

export type ControlResult =
  | { success: true; decision: ControlDecision }
  | {
      success: false;
      reason:
        | typeof IngestReasonCode.UNKNOWN_ALIAS
        | typeof IngestReasonCode.TIMEOUT
        | typeof IngestReasonCode.TRANSIENT_UPSTREAM;
      message: string;
    };

export interface IngestDocumentInput {
  hash: string;
  sizeBytes: number;
  mimeType: string;
  filename?: string;
}

export interface IngestInput {
  grantJti: string;
  idempotencyKey: string;
  tenantId: string;
  messageId: string;
  rawMessageHash: string;
  correlationId?: string;
  extractedDocuments: IngestDocumentInput[];
}

export type IngestResult =
  | {
      success: true;
      outcome: 'INSERTED' | 'DUPLICATE' | 'QUARANTINED' | 'REJECTED';
      ingestId: string | null | undefined;
      existingIngestId: string | null | undefined;
      auditId: string;
      reasonCode: string | null | undefined;
    }
  | {
      success: false;
      reason:
        | typeof IngestReasonCode.GRANT_INVALID
        | typeof IngestReasonCode.TIMEOUT
        | typeof IngestReasonCode.TRANSIENT_UPSTREAM;
      message: string;
    };

// ---------------------------------------------------------------------------
// Dependency injection interface
// ---------------------------------------------------------------------------

export interface ServerClientDeps {
  serverUrl: string;
  cpToken: string;
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
}

// ---------------------------------------------------------------------------
// HTTP error sentinel
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// ---------------------------------------------------------------------------
// Retry helpers
// ---------------------------------------------------------------------------

function isTimeoutError(err: unknown): boolean {
  if (err instanceof DOMException) return err.name === 'TimeoutError' || err.name === 'AbortError';
  if (err instanceof Error) return err.name === 'TimeoutError' || err.name === 'AbortError';
  return false;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) return err.status >= 500;
  return true; // network errors, timeouts — always retryable
}

function classifyFinalError(
  err: unknown,
): typeof IngestReasonCode.TIMEOUT | typeof IngestReasonCode.TRANSIENT_UPSTREAM {
  return isTimeoutError(err) ? IngestReasonCode.TIMEOUT : IngestReasonCode.TRANSIENT_UPSTREAM;
}

// ---------------------------------------------------------------------------
// ServerClient
// ---------------------------------------------------------------------------

export class ServerClient {
  private readonly serverUrl: string;
  private readonly cpToken: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(deps: ServerClientDeps) {
    this.serverUrl = deps.serverUrl;
    this.cpToken = deps.cpToken;
    this.fetchFn = deps.fetch ?? globalThis.fetch;
    this.sleep = deps.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async requestControl(input: ControlInput): Promise<ControlResult> {
    try {
      const data = await this.withRetry(
        () => this.gqlPost(REQUEST_INGEST_CONTROL_MUTATION, { input }, CONTROL_TIMEOUT_MS),
        CONTROL_MAX_RETRIES,
        100,
      );
      const result = (
        data as {
          requestIngestControl?: { __typename: string; message?: string } & ControlDecision;
        }
      )?.requestIngestControl;
      if (!result) {
        return {
          success: false,
          reason: IngestReasonCode.TRANSIENT_UPSTREAM,
          message: 'Invalid or empty response from server',
        };
      }
      if (result.__typename === 'CommonError') {
        return {
          success: false,
          reason: IngestReasonCode.UNKNOWN_ALIAS,
          message: result.message ?? 'Unknown alias',
        };
      }
      return { success: true, decision: result as unknown as ControlDecision };
    } catch (err) {
      return {
        success: false,
        reason: classifyFinalError(err),
        message: String(err),
      };
    }
  }

  async requestIngest(input: IngestInput): Promise<IngestResult> {
    try {
      const data = await this.withRetry(
        () => this.gqlPost(INGEST_EMAIL_MUTATION, { input }, INGEST_TIMEOUT_MS),
        INGEST_MAX_RETRIES,
        100,
      );
      const result = (
        data as {
          ingestEmail?: {
            __typename: string;
            message?: string;
            outcome?: string;
            ingestId?: string | null;
            existingIngestId?: string | null;
            auditId?: string;
            reasonCode?: string | null;
          };
        }
      )?.ingestEmail;
      if (!result) {
        return {
          success: false,
          reason: IngestReasonCode.TRANSIENT_UPSTREAM,
          message: 'Invalid or empty response from server',
        };
      }
      if (result.__typename === 'CommonError') {
        return {
          success: false,
          reason: IngestReasonCode.GRANT_INVALID,
          message: result.message ?? 'Ingest failed',
        };
      }
      return {
        success: true,
        outcome: result.outcome as 'INSERTED' | 'DUPLICATE' | 'QUARANTINED' | 'REJECTED',
        ingestId: result.ingestId,
        existingIngestId: result.existingIngestId,
        auditId: result.auditId ?? '',
        reasonCode: result.reasonCode,
      };
    } catch (err) {
      return {
        success: false,
        reason: classifyFinalError(err),
        message: String(err),
      };
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async gqlPost(query: string, variables: unknown, timeoutMs: number): Promise<unknown> {
    const res = await this.fetchFn(`${this.serverUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-CP-Token': this.cpToken,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new HttpError(res.status, await res.text());
    }

    const json = (await res.json()) as { data?: unknown; errors?: Array<{ message: string }> };
    if (json.errors && json.errors.length > 0) {
      throw new Error('GraphQL errors: ' + json.errors.map(e => e.message).join(', '));
    }
    return json.data;
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelayMs: number,
  ): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        return await fn();
      } catch (err) {
        if (attempt >= maxRetries || !isRetryable(err)) throw err;
        await this.sleep(baseDelayMs * Math.pow(2, attempt));
        attempt++;
      }
    }
  }
}
