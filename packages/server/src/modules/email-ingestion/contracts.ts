/**
 * Canonical outcome and reason-code constants for the email-ingestion module.
 *
 * These are the authoritative definitions on the server side. The gateway
 * package holds an independent duplicate — no runtime import between them.
 */

export const IngestOutcome = {
  INSERTED: 'inserted',
  DUPLICATE: 'duplicate',
  QUARANTINED: 'quarantined',
  REJECTED: 'rejected',
  // Deliberately not ingested — the canonical case is a self-issued document. The
  // email is recorded (audit row + idempotency key) so a re-delivery short-circuits
  // and the decision stays inspectable, but it is not an operational failure and
  // must not surface in the quarantine triage queue as one.
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
  TRANSIENT_UPSTREAM: 'TRANSIENT_UPSTREAM',
  // Self-issued document: a copy of an invoice the tenant issued itself (e.g. via
  // Morning/greeninvoice), whose document already exists from creation. The email
  // is IGNORED — recorded and inspectable, but not inserted and not counted as a
  // failure. The classification comes from the control step
  // (EmailKind.SELF_ISSUED), which distinguishes it from a forwarded supplier
  // invoice whose addresses all happened to belong to the tenant; that case used to
  // land here and be dropped.
  SELF_ISSUED: 'SELF_ISSUED',
  // Document preparation failed on the server (e.g. Cloudinary upload error)
  // after the email was accepted. The email is QUARANTINED (recorded, retryable
  // via the quarantine reprocessing workflow) rather than throwing and leaving
  // no durable trace.
  UPLOAD_FAILED: 'UPLOAD_FAILED',
} as const;

export type IngestReasonCode = (typeof IngestReasonCode)[keyof typeof IngestReasonCode];
