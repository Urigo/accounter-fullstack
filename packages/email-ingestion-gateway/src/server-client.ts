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
/**
 * Control is side-effect-free before `issueGrant`, so it can afford a real retry
 * budget. With {@link CONTROL_BASE_DELAY_MS} the backoff is 250/500/1000/2000 ms
 * — up to ~3.75 s of sleep across 5 attempts, plus jitter. The previous budget
 * (2 retries at 100 ms base = 300 ms total) was orders of magnitude tighter than
 * the 3 s per-attempt timeout it sat under, and could not ride out a server
 * restart or a cold connection pool.
 */
export const CONTROL_MAX_RETRIES = 4;
export const CONTROL_BASE_DELAY_MS = 250;
export const INGEST_TIMEOUT_MS = 30_000;
/**
 * Deliberately NOT widened: the ingest grant is single-use, so a retry that the
 * server actually received burns it and comes back GRANT_INVALID.
 */
export const INGEST_MAX_RETRIES = 1;
export const INGEST_BASE_DELAY_MS = 100;
/**
 * Fraction of the computed backoff added as random jitter. Inbound bursts (the
 * logs show 6 webhooks within 2 s) would otherwise retry in lockstep and hit a
 * recovering upstream all at once.
 */
export const RETRY_JITTER_RATIO = 0.25;
/** Upper bound on the error text carried into a failure result and the logs. */
export const MAX_ERROR_MESSAGE_LENGTH = 500;

// ---------------------------------------------------------------------------
// Domain types (public API)
// ---------------------------------------------------------------------------

/** A quoted forwarded-header block recovered from the body. */
export interface ControlForwardedBlock {
  from?: string;
  fromDisplayName?: string;
  to?: string[];
  subject?: string;
}

/** Structural sender evidence for server-side classification / business recognition. */
export interface ControlSenderEvidence {
  from?: string;
  fromDisplayName?: string;
  replyTo?: string;
  originalFrom?: string;
  originalSender?: string;
  forwardedTo?: string;
  listId?: string;
  listAddresses?: string[];
  forwardedBlocks?: ControlForwardedBlock[];
  issuerCandidates?: string[];
}

/** How the server classified the email; drives what treatment is worth doing. */
export type EmailClassificationKind = 'DIRECT' | 'RELAYED' | 'FORWARDED' | 'SELF_ISSUED';

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

/** Per-business email-processing config returned by control (null = unrecognized). */
export interface BusinessEmailConfig {
  businessId: string;
  internalEmailLinks: string[] | null;
  emailBody: boolean | null;
  /** Allowed attachment document types (e.g. 'PDF', 'PNG', 'JPEG'); null = keep all. */
  attachments: string[] | null;
}

export interface ControlDecision {
  id: string;
  tenantId: string;
  decisionId: string;
  auditId: string;
  grant: GrantData;
  /** Recognized issuing business + its treatment config; null when unrecognized. */
  businessEmailConfig: BusinessEmailConfig | null;
  classification: EmailClassificationKind;
}

/**
 * Diagnostics attached to every failure result, so a denial can be read off one
 * log line instead of being reconstructed from `durationMs` against the retry
 * policy (see #4345).
 */
export interface UpstreamFailureDetails {
  /** Truncated error text — the one field that distinguishes the failure modes. */
  message: string;
  /** HTTP status, when the server actually answered. Absent for transport failures. */
  status?: number;
  /** How many attempts were made in total (1 = never retried). */
  attempts: number;
}

export type ControlResult =
  | { success: true; decision: ControlDecision }
  | ({
      success: false;
      reason:
        | typeof IngestReasonCode.UNKNOWN_ALIAS
        | typeof IngestReasonCode.TIMEOUT
        | typeof IngestReasonCode.TRANSIENT_UPSTREAM
        | typeof IngestReasonCode.UPSTREAM_ERROR;
    } & UpstreamFailureDetails);

export interface IngestDocumentInput {
  hash: string;
  sizeBytes: number;
  mimeType: string;
  filename?: string;
  /** Base64-encoded document bytes — Option B inline transport to the server. */
  content?: string;
}

export interface IngestInput {
  grantJti: string;
  idempotencyKey: string;
  tenantId: string;
  messageId: string;
  rawMessageHash: string;
  correlationId?: string;
  /** Email subject header, forwarded for the server-side charge description. */
  subject?: string;
  /** Sender (From header) address, forwarded for the server-side charge description. */
  sender?: string;
  /** ISO-8601 received-at timestamp, forwarded for the server-side charge description. */
  receivedAt?: string;
  extractedDocuments: IngestDocumentInput[];
}

export type IngestResult =
  | {
      success: true;
      outcome: 'INSERTED' | 'DUPLICATE' | 'QUARANTINED' | 'REJECTED' | 'IGNORED';
      ingestId: string | null | undefined;
      existingIngestId: string | null | undefined;
      auditId: string;
      reasonCode: string | null | undefined;
    }
  | ({
      success: false;
      reason:
        | typeof IngestReasonCode.GRANT_INVALID
        | typeof IngestReasonCode.TIMEOUT
        | typeof IngestReasonCode.TRANSIENT_UPSTREAM
        | typeof IngestReasonCode.UPSTREAM_ERROR;
    } & UpstreamFailureDetails);

// ---------------------------------------------------------------------------
// Dependency injection interface
// ---------------------------------------------------------------------------

export interface ServerClientDeps {
  serverUrl: string;
  cpToken: string;
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Jitter source in [0, 1); injectable so backoff is deterministic under test. */
  random?: () => number;
}

// ---------------------------------------------------------------------------
// Retry helpers
// ---------------------------------------------------------------------------

function isTimeoutError(err: unknown): boolean {
  if (err instanceof DOMException) return err.name === 'TimeoutError' || err.name === 'AbortError';
  if (err instanceof Error) return err.name === 'TimeoutError' || err.name === 'AbortError';
  return false;
}

/** Statuses that mean "answered, but come back later" rather than a terminal no. */
const RETRYABLE_CLIENT_STATUSES = new Set([408, 425, 429]);

function isRetryable(err: unknown, retryOnTimeout = true): boolean {
  if (err instanceof ClientError) {
    const status = err.response.status ?? 500;
    // 5xx is the server failing; 408/425/429 are explicit "retry" statuses. Every
    // other 4xx (400/401/403/404/413) is terminal — retrying only wastes time.
    return status >= 500 || RETRYABLE_CLIENT_STATUSES.has(status);
  }
  // A timeout means the server may still be processing. Safe to retry for control
  // (no side effect), but NOT for ingest — a retry there would hit an
  // already-consumed single-use grant and fail with GRANT_INVALID.
  if (isTimeoutError(err)) return retryOnTimeout;
  return true; // network errors (TypeError: fetch failed) — server never received the request
}

/**
 * A `ClientError` means the server answered — either a non-2xx status, or (the
 * case that hid the incident in #4344) HTTP 200 with a GraphQL `errors[]` array,
 * which is how a server-side exception surfaces through yoga. Those are not
 * transient and must not be labelled as such. A 5xx is the server failing rather
 * than refusing, and is expected to clear, so it stays TRANSIENT_UPSTREAM
 * alongside the transport failures.
 */
function classifyFinalError(
  err: unknown,
):
  | typeof IngestReasonCode.TIMEOUT
  | typeof IngestReasonCode.TRANSIENT_UPSTREAM
  | typeof IngestReasonCode.UPSTREAM_ERROR {
  if (isTimeoutError(err)) return IngestReasonCode.TIMEOUT;
  if (err instanceof ClientError) {
    const status = err.response.status ?? 500;
    return status >= 500 ? IngestReasonCode.TRANSIENT_UPSTREAM : IngestReasonCode.UPSTREAM_ERROR;
  }
  return IngestReasonCode.TRANSIENT_UPSTREAM;
}

/** HTTP status of an upstream answer, when there was one. */
function statusOf(err: unknown): number | undefined {
  return err instanceof ClientError ? (err.response.status ?? undefined) : undefined;
}

/**
 * Render an error for logging. `String(err)` on a `ClientError` embeds the whole
 * response body — which can be a multi-kilobyte HTML error page from a proxy —
 * so a `ClientError` is reduced to its status plus the GraphQL error messages,
 * and everything is truncated.
 */
export function formatUpstreamError(err: unknown): string {
  let text: string;
  if (err instanceof ClientError) {
    const status = err.response.status ?? 'unknown';
    const messages = (err.response.errors ?? [])
      .map(e => e.message)
      .filter(Boolean)
      .join('; ');
    text = `HTTP ${status}${messages ? `: ${messages}` : `: ${err.message}`}`;
  } else {
    text = String(err);
  }
  return text.length > MAX_ERROR_MESSAGE_LENGTH
    ? `${text.slice(0, MAX_ERROR_MESSAGE_LENGTH)}… [truncated]`
    : text;
}

function failureDetails(err: unknown, attempts: number): UpstreamFailureDetails {
  const status = statusOf(err);
  return { message: formatUpstreamError(err), attempts, ...(status ? { status } : {}) };
}

// ---------------------------------------------------------------------------
// ServerClient
// ---------------------------------------------------------------------------

export class ServerClient {
  private readonly gqlClient: GraphQLClient;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(deps: ServerClientDeps) {
    this.gqlClient = new GraphQLClient(`${deps.serverUrl}/graphql`, {
      headers: { 'X-Gateway-CP-Token': deps.cpToken },
      fetch: deps.fetch,
    });
    this.sleep = deps.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.random = deps.random ?? Math.random;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async requestControl(input: ControlInput): Promise<ControlResult> {
    const counter = { attempts: 0 };
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
        CONTROL_BASE_DELAY_MS,
        true,
        counter,
      );
      // `data` itself can be null when the server answers 200 with a body that does
      // not match the contract; the optional chain routes that into the same
      // UPSTREAM_ERROR branch instead of throwing a TypeError classified as transport.
      const result = data?.requestIngestControl;
      if (!result) {
        return {
          success: false,
          // The server answered 200 with a body the contract does not allow.
          reason: IngestReasonCode.UPSTREAM_ERROR,
          message: 'Invalid or empty response from server',
          attempts: counter.attempts,
        };
      }
      if (result.__typename === 'CommonError') {
        return {
          success: false,
          reason: IngestReasonCode.UNKNOWN_ALIAS,
          message: result.message ?? 'Unknown alias',
          attempts: counter.attempts,
        };
      }
      const cfg = result.businessEmailConfig;
      return {
        success: true,
        decision: {
          id: result.id,
          tenantId: result.tenantId,
          decisionId: result.decisionId,
          auditId: result.auditId,
          grant: {
            id: result.grant.id,
            jti: result.grant.jti,
            tenantId: result.grant.tenantId,
            action: result.grant.action,
            expiresAt: result.grant.expiresAt,
          },
          businessEmailConfig: cfg
            ? {
                businessId: cfg.businessId,
                internalEmailLinks: cfg.internalEmailLinks ?? null,
                emailBody: cfg.emailBody ?? null,
                attachments: cfg.attachments ?? null,
              }
            : null,
          classification: result.classification,
        },
      };
    } catch (err) {
      return {
        success: false,
        reason: classifyFinalError(err),
        ...failureDetails(err, counter.attempts),
      };
    }
  }

  async requestIngest(input: IngestInput): Promise<IngestResult> {
    const counter = { attempts: 0 };
    try {
      const data = await this.withRetry(
        () =>
          this.gqlClient.request<IngestEmailMutation, IngestEmailMutationVariables>({
            document: INGEST_EMAIL_MUTATION,
            variables: { input },
            signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
          }),
        INGEST_MAX_RETRIES,
        INGEST_BASE_DELAY_MS,
        false, // do not retry ingest on timeout — would burn the single-use grant
        counter,
      );
      const result = data?.ingestEmail;
      if (!result) {
        return {
          success: false,
          // The server answered 200 with a body the contract does not allow.
          reason: IngestReasonCode.UPSTREAM_ERROR,
          message: 'Invalid or empty response from server',
          attempts: counter.attempts,
        };
      }
      if (result.__typename === 'CommonError') {
        return {
          success: false,
          reason: IngestReasonCode.GRANT_INVALID,
          message: result.message ?? 'Ingest failed',
          attempts: counter.attempts,
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
        ...failureDetails(err, counter.attempts),
      };
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * @param counter mutable holder the caller reads back after a failure, so the
   *   attempt count can be logged instead of inferred from elapsed time.
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelayMs: number,
    retryOnTimeout = true,
    counter: { attempts: number } = { attempts: 0 },
  ): Promise<T> {
    let attempt = 0;
    for (;;) {
      counter.attempts = attempt + 1;
      try {
        return await fn();
      } catch (err) {
        if (attempt >= maxRetries || !isRetryable(err, retryOnTimeout)) throw err;
        await this.sleep(this.backoffMs(baseDelayMs, attempt));
        attempt++;
      }
    }
  }

  /** Exponential backoff with additive jitter, so concurrent retries desynchronize. */
  private backoffMs(baseDelayMs: number, attempt: number): number {
    const delay = baseDelayMs * Math.pow(2, attempt);
    return Math.round(delay + delay * RETRY_JITTER_RATIO * this.random());
  }
}
