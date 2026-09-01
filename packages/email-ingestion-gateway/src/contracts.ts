/**
 * Canonical outcome and reason-code constants for the email-ingestion gateway.
 *
 * Intentionally duplicated from the server package — no runtime import between
 * packages. Parity is enforced by the parallel test suites in each package.
 */

export const IngestOutcome = {
  INSERTED: 'inserted',
  DUPLICATE: 'duplicate',
  QUARANTINED: 'quarantined',
  REJECTED: 'rejected',
  IGNORED: 'ignored',
} as const;

export type IngestOutcome = (typeof IngestOutcome)[keyof typeof IngestOutcome];

export const IngestReasonCode = {
  UNKNOWN_ALIAS: 'UNKNOWN_ALIAS',
  INVALID_AUTH: 'INVALID_AUTH',
  REPLAY_DETECTED: 'REPLAY_DETECTED',
  GRANT_INVALID: 'GRANT_INVALID',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  NO_DOCUMENTS: 'NO_DOCUMENTS',
  PARSE_ERROR: 'PARSE_ERROR',
  OVERSIZE_MESSAGE: 'OVERSIZE_MESSAGE',
  TIMEOUT: 'TIMEOUT',
  // The call never reached a responding server, or the server failed in a way
  // that is expected to clear on its own: connection refused, DNS/TLS failure,
  // connection reset, or any 5xx. Retried by the gateway's retry policy.
  TRANSIENT_UPSTREAM: 'TRANSIENT_UPSTREAM',
  // The server *answered* and said no: a 4xx, or HTTP 200 carrying a GraphQL
  // `errors[]` array (which is how a server-side exception surfaces through
  // yoga). Not transient — it will not clear by waiting, and it is not retried
  // except for the explicitly retryable statuses (429/503). Split out of
  // TRANSIENT_UPSTREAM, which used to cover both and made a persistent
  // server-side bug read as a passing cloud.
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  // Self-issued document: a copy of an invoice the tenant issued itself (e.g. via
  // Morning/greeninvoice), whose document already exists from creation. The email
  // is IGNORED — recorded and inspectable, but not inserted and not counted as a
  // failure. The classification comes from the server's control step, which
  // distinguishes it from a forwarded supplier invoice whose addresses all happened
  // to belong to the tenant; that case used to land here and be dropped.
  SELF_ISSUED: 'SELF_ISSUED',
  // Document preparation failed on the server (e.g. Cloudinary upload error)
  // after the email was accepted. The email is QUARANTINED (recorded, retryable
  // via the quarantine reprocessing workflow) rather than throwing and leaving
  // no durable trace.
  UPLOAD_FAILED: 'UPLOAD_FAILED',
} as const;

export type IngestReasonCode = (typeof IngestReasonCode)[keyof typeof IngestReasonCode];
