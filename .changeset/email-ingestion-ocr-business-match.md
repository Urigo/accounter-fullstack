---
'@accounter/server': patch
---

Recognize the issuing business from the **document itself** when ingesting email documents, so
invoices that arrive through an aggregator/forwarder no longer land with an empty creditor/debtor.

Recognition on the ingest path was sender-address-only: `recognizeBusinessFromEvidence` looks the
sender up in `businesses.suggestion_data->'emails'` and pins the result into the grant. When mail
arrives via an aggregator (e.g. `sync@wellybox.com`) nothing matches, and the OCR name/VAT matcher
that should have covered it was silently inert — `getOcrData` loads its business list through the
auth-coupled `BusinessesProvider` / `AdminContextProvider`, whose `TenantAwareDBClient` throws
`Missing businessId in AuthContext` under the gateway control-plane context, and both fetchers
swallowed the error into an empty list. With no businesses, `matchBusiness` bails immediately and the
LLM match fallback is gated off, so `suggestedIssuer` was always null. `resolveOwnerSideFromUuids` —
which turns those matches into `counterpartyId` / `isOwnerIssuer` — was also only ever called from
the manual-upload path. Net effect: the issuer's legal name was extracted correctly and stored in the
document's `remarks`, then discarded, even when a business with exactly that name existed.

- `getOcrData` accepts an optional `matchContext` (`{ businesses, owner }`) that bypasses the
  auth-coupled loaders, mirroring the existing `vatFallbackContext` escape hatch. Callers that omit
  it (manual upload) are unchanged.
- `EmailIngestionIngestProvider.prepareDocuments` loads the tenant's businesses and locality via the
  raw pool under the tenant's RLS context (alongside the existing hash-dedup read), passes them to
  the matcher, then applies `resolveOwnerSideFromUuids`. The grant's email-matched business stays
  authoritative and the OCR match only fills the gap; a disagreement between the two is logged. The
  counterparty country for the VAT-0 fallback now comes off that same list against the final
  counterparty, replacing a separate query.
- `isOwnerIssuer` can now be set on this path, so an OCR-identified owner-issued document gets
  `creditor = tenant, debtor = counterparty` instead of the previous unconditional orientation.
- The failed business/owner loads are now logged instead of being swallowed silently.

Forward-only: documents already inserted with a null creditor are not backfilled.
