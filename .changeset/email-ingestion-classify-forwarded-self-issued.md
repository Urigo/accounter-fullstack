---
'@accounter/email-ingestion-gateway': patch
'@accounter/server': patch
---

Classify incoming email as `DIRECT` / `RELAYED` / `FORWARDED` / `SELF_ISSUED` before recognizing an
issuer, so **manually forwarded** supplier invoices stop being withheld as self-issued and
**self-issued** copies are detected for every tenant rather than one hard-coded one.

Issuer recognition was sound for mail sent straight to the tenant, but collapsed on two shapes that
dominate real inboxes. A hand forward rewrites `From` to the forwarder, drops the original
`Reply-To`, and sets no `X-Original-*`; when the quoted headers are themselves a mailing-list rewrite
(`'No Reply - Mailchimp' via Account Payables <ap@…>`), *every* recoverable address belongs to the
tenant — so recognition matched the tenant's own business and ingest withheld the document. A
forwarded Mailchimp invoice was indistinguishable from a genuine self-issued one. Separately,
self-issued detection fired only because `INVOICE_ISSUING_PROVIDER_EMAILS` hard-coded one specific
tenant's forwarding group (`ap@the-guild.dev`); no other tenant had any detection at all.

- **Server `email-ingestion-classify.helper.ts`** (new, replaces `email-ingestion-issuer.helper.ts`):
  a single `classifyEmail(evidence, tenantContext)` returning `{ kind, issuerCandidates, forwarder,
  issuerNameHint }`, absorbing `selectIssuerEmail` / `selectIssuerCandidates` /
  `isSelfIssuedSenderEvidence` and the branching that lived in the control resolver. Kind is decided
  first-match-wins, with "a quoted forward block exists" outranking "arrived via an invoice
  platform": a person deliberately forwarding into the ingest alias signals intent to ingest, whereas
  self-issued confirmations always arrive by automatic relay, never by hand. Issuer candidates are
  tiered (innermost quoted `From` → `Reply-To` → `X-Original-From` → `From` → body `mailto:`, with
  invoice-platform addresses held back to last), and the tenant's own addresses, its mailing-list
  addresses and the forwarder are excluded at every tier. `issuerNameHint` carries the sender's
  display name for the case where a list rewrite leaves no usable address at all — the only signal
  the name-based matcher and OCR can work from.
- **Server `EmailIngestionControlProvider.loadTenantMailContext`** (60 s TTL cache): derives the
  tenant's own addresses from its active ingest aliases plus the emails on its **own** business row —
  deliberately `b.id = tenant`, not `b.owner_id = tenant`, since the latter is every counterparty in
  the workspace and would exclude every supplier from recognition. Colleagues registered nowhere are
  covered by new optional `suggestion_data.emailIngestion` config (`ownDomains`,
  `extraPlatformSenders`), a schema-only addition with no DDL.
- **Server: self-issued mail is now `IngestOutcome.IGNORED`, not `QUARANTINED`.** It is still
  recorded and reprocessable, but routine self-issued copies no longer fill the operator triage
  queue. The signal is the new `email_ingestion_grants.classification` column bound at control time,
  replacing the `business_id = owner_id` inference that conflated the two cases in the first place;
  grants issued before the column fall back to that comparison.
- **Gateway `forwarded.ts`** (new): structural parsing of quoted `---------- Forwarded message
  ---------` blocks across both the text and HTML parts. Forwards nest, and the block nearest the
  original sender is the innermost one — ordering the previous flat address scrape could not express.
  The extractor now ships `fromDisplayName`, `originalSender`, `listId`, `listAddresses` and
  `forwardedBlocks` as additive sender evidence; the gateway still holds no tenant knowledge.
- **Gateway `treatment.ts`**: a `SELF_ISSUED` email produces no documents at all, skipping a Chromium
  render per message and — more importantly — never fetching whatever sits behind its links.
- Two parsing defects fixed along the way: `addressParser` strips `(via Paddle.com)` as an RFC 5322
  comment, so quoted display names are now sliced rather than parsed; and `headerValue` returned the
  first match, letting `X-Original-From` shadow `X-Original-Sender` — the most reliable "arrived via
  an invoice platform" signal. They are separate evidence fields now.

**Deploy the server before the gateway.** GraphQL rejects unknown fields on input objects at
validation, so a gateway sending the new `SenderEvidenceInput` fields to an un-upgraded server gets
an error that `server-client` maps to `TRANSIENT_UPSTREAM` and retries — stalling all inbound mail.
The reverse is safe: an upgraded server receiving old evidence degrades to header-only
classification. `ap@the-guild.dev` remains in the global invoice-platform list so behavior is
unchanged until that tenant's `emailIngestion.ownDomains` config is populated and verified in
production; remove it then.

Forward-only: emails already quarantined as `SELF_ISSUED` are not reclassified.
