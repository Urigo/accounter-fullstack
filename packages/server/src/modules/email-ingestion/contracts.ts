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
  // Self-issued document: a confirmation email for an invoice the tenant issued
  // itself (e.g. via Morning/greeninvoice). The underlying document already
  // exists on the server from creation, so the email is skipped as a DUPLICATE.
  SELF_ISSUED: 'SELF_ISSUED',
} as const;

export type IngestReasonCode = (typeof IngestReasonCode)[keyof typeof IngestReasonCode];
