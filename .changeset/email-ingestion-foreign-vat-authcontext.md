---
'@accounter/server': patch
---

Fix `UPLOAD_FAILED` quarantine (`Missing businessId in AuthContext`) when ingesting a recognized
foreign supplier invoice through the email-ingestion gateway.

The gateway ingest runs under a `gateway_control_plane` context with no auth session, so it
deliberately uses `withTenantContext` (raw pool + pinned RLS) instead of `TenantAwareDBClient`. But
the shared `getDocumentFromUrlsAndOcrData` helper's foreign-counterparty VAT-0 fallback reached into
the auth-coupled `BusinessesProvider` / `AdminContextProvider` loaders, whose `TenantAwareDBClient`
throws `Missing businessId in AuthContext` in that context. The throw became a
`DocumentPreparationError` → `UPLOAD_FAILED` quarantine, so any recognized **foreign** supplier
invoice (VAT null) forwarded through the gateway was quarantined instead of inserted.

- `getDocumentFromUrlsAndOcrData` now accepts an optional `vatFallbackContext`
  (`{ counterpartyCountry, adminLocality }`); when provided it drives the VAT-0 fallback instead of
  the auth-coupled loaders. The legacy path (no argument) is unchanged.
- `EmailIngestionIngestProvider.prepareDocuments` resolves the counterparty country and the tenant's
  admin locality via the raw pool under the tenant's RLS context (alongside the existing hash-dedup
  read) and passes them in — so the control-plane ingest never touches the auth-coupled providers.
