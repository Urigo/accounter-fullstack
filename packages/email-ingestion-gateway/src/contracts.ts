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
  TRANSIENT_UPSTREAM: 'TRANSIENT_UPSTREAM',
  // Self-issued document: the recognized issuer is the tenant's own business —
  // typically a confirmation email for an invoice the tenant issued itself (e.g.
  // via Morning/greeninvoice), whose document already exists from creation. The
  // email is not inserted; it is QUARANTINED (recorded, visible, reprocessable)
  // rather than dropped, because the same signal can also fire on a real supplier
  // invoice that collapsed onto the tenant's own forwarding address.
  SELF_ISSUED: 'SELF_ISSUED',
  // Document preparation failed on the server (e.g. Cloudinary upload error)
  // after the email was accepted. The email is QUARANTINED (recorded, retryable
  // via the quarantine reprocessing workflow) rather than throwing and leaving
  // no durable trace.
  UPLOAD_FAILED: 'UPLOAD_FAILED',
} as const;

export type IngestReasonCode = (typeof IngestReasonCode)[keyof typeof IngestReasonCode];
