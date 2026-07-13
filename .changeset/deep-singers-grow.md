---
'@accounter/server': patch
---

- **New helper function `isSelfIssuedSenderEvidence()`** in `email-ingestion-issuer.helper.ts`:
  Detects when an email's only determinable issuer is a known provider (Morning, Sumit) or the
  tenant's own forwarding address, indicating no external counterparty. Reuses existing
  `selectIssuerEmail()` logic to ensure consistency with issuer resolution.

- **Self-issued binding in control resolver** (`email-ingestion-control.resolver.ts`): When
  `isSelfIssuedSenderEvidence()` returns true, the grant's `businessId` is set to the tenant's own
  ID instead of the recognized business. This signals to the ingest step that the issuer is the
  tenant itself. Also returns `null` for `businessEmailConfig` to spare the gateway needless
  document work (link-fetch, body→PDF conversion).

- **Early short-circuit in ingest provider** (`email-ingestion-ingest.provider.ts`): After grant
  validation, checks if `grant.businessId === tenantId`. If true, returns `DUPLICATE` outcome with
  new `SELF_ISSUED` reason code, skipping all document processing (Cloudinary upload, OCR, dedup
  queries, insert queries). Runs before `prepareDocuments()` to avoid unnecessary work.

- **New `IngestReasonCode.SELF_ISSUED`** constant in both `contracts.ts` files (server and gateway):
  Distinguishes self-issued skips from content re-deliveries in duplicate outcomes.

- **Comprehensive test coverage**: Added test suites for the new helper function and ingest
  behavior, verifying that self-issued emails are detected correctly, grants are consumed, and no
  document work or database writes occur.
