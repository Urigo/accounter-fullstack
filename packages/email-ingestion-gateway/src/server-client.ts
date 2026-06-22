import { ClientError, GraphQLClient } from 'graphql-request';
import { IngestReasonCode } from './contracts.js';
import type {
  IngestEmailMutation,
  IngestEmailMutationVariables,
  RequestIngestControlMutation,
  RequestIngestControlMutationVariables,
} from './gql/index.js';
import { INGEST_EMAIL_MUTATION, REQUEST_INGEST_CONTROL_MUTATION } from './graphql/mutations.js';

// ---------------------------------------------------------------------------
// Exported policy constants
// ---------------------------------------------------------------------------

export const CONTROL_TIMEOUT_MS = 3000;
export const CONTROL_MAX_RETRIES = 2;
export const INGEST_TIMEOUT_MS = 10_000;
export const INGEST_MAX_RETRIES = 1;

// ---------------------------------------------------------------------------
// Domain types (public API)
// ---------------------------------------------------------------------------

/** Candidate sender addresses for server-side issuer/business recognition. */
export interface ControlSenderEvidence {
  from?: string;
  replyTo?: string;
  originalFrom?: string;
  forwardedTo?: string;
  issuerCandidates?: string[];
}

export interface ControlInput {
  recipientAlias: string;
  messageId: string;
  rawMessageHash: string;
  receivedAt?: string;
  correlationId?: string;
  senderEvidence?: ControlSenderEvidence;
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
// Retry helpers
// ---------------------------------------------------------------------------

function isTimeoutError(err: unknown): boolean {
  if (err instanceof DOMException) return err.name === 'TimeoutError' || err.name === 'AbortError';
  if (err instanceof Error) return err.name === 'TimeoutError' || err.name === 'AbortError';
  return false;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof ClientError) return (err.response.status ?? 500) >= 500;
  return true; // network errors (TypeError), timeouts (DOMException) — always retryable
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
  private readonly gqlClient: GraphQLClient;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(deps: ServerClientDeps) {
    this.gqlClient = new GraphQLClient(`${deps.serverUrl}/graphql`, {
      headers: { 'X-Gateway-CP-Token': deps.cpToken },
      fetch: deps.fetch,
    });
    this.sleep = deps.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async requestControl(input: ControlInput): Promise<ControlResult> {
    try {
      const data = await this.withRetry(
        () =>
          this.gqlClient.request<
            RequestIngestControlMutation,
            RequestIngestControlMutationVariables
          >({
            document: REQUEST_INGEST_CONTROL_MUTATION,
            variables: { input },
            signal: AbortSignal.timeout(CONTROL_TIMEOUT_MS),
          }),
        CONTROL_MAX_RETRIES,
        100,
      );
      const result = data.requestIngestControl;
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
      return { success: true, decision: result };
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
        () =>
          this.gqlClient.request<IngestEmailMutation, IngestEmailMutationVariables>({
            document: INGEST_EMAIL_MUTATION,
            variables: { input },
            signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
          }),
        INGEST_MAX_RETRIES,
        100,
      );
      const result = data.ingestEmail;
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
        auditId: result.auditId,
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
