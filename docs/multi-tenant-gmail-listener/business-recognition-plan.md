# Business-Recognition-Driven Treatment in v2 Email Ingestion

> **Status:** Design / not yet implemented. This document is the agreed plan; implementation lands
> in follow-up commits on the same PR.

## Background

The legacy `gmail-listener` flow did more than extract attachments. For every inbound email it:

1. **Recognized the provider business** behind the email — it computed an "issuer email"
   (`getIssuerEmail`) and called the server's `businessEmailConfig` query, which looked the business
   up by `suggestion_data->'emails'` and returned that business's `emailListener` config.
2. **Loaded business-specific config** — `internalEmailLinks`, `emailBody`, `attachments`.
3. **Treated the email per that config**:
   - filtered attachments by the allowed `attachments` document types;
   - if no business was recognized, or `emailBody === true`, rendered the HTML body to a PDF
     (`convertHtmlToPdf`);
   - for each `internalEmailLinks` entry, fetched a document from the matching internal URL inside
     the email body (`innerLinkDocumentFetcher`);
   - inserted the resulting documents linked to the recognized `businessId`.

Reference: `packages/gmail-listener/src/gmail-service.ts` (`handleMessage`, ~lines 437-539) and the
server resolver `packages/server/src/modules/email-ingestion/resolvers/email-ingestion.resolver.ts`
(`businessEmailConfig`).

The new v2 Cloudflare → Gateway → Server flow (PR #3651) **does not** carry this behavior:

- Tenant resolution is by **recipient alias** (`email_ingestion_alias_routing`), which identifies the
  Accounter **tenant the mail was sent to** — not the **sending provider business**.
- Document extraction is a fixed, tenant-agnostic MIME allowlist (`mime-extractor.ts`); no
  `suggestion_data` is consulted.
- There is no body→PDF conversion, no internal-link fetching, no per-business attachment filtering.
- The v2 ingest contract currently transmits only document **metadata** (`hash`, `sizeBytes`,
  `mimeType`, `filename`) — **no bytes** — and document persistence is still a `TODO`
  (`email-ingestion-ingest.provider.ts`, "Document storage is deferred").

This is a real parity gap. Provider emails differ, so **the treatment must be selected after the
provider (business) is recognized.** Recognizing the business is therefore a *requirement*, not an
optimization.

## Goal

Port the "recognize provider business → load its `emailListener` config → treat the email
accordingly" behavior into the v2 flow, with persistence of the resulting documents under the
recognized business — while respecting the v2 trust model (greenfield gateway, no shared runtime,
control-plane gateway identity that cannot insert documents directly).

## Recommended architecture: the responsibility split

The constraint "treatment must follow recognition" plus two physical facts — recognition needs the
DB (`suggestion_data`), and treatment needs the raw email body plus network egress (link-fetch) and
HTML→PDF rendering — force a three-stage split. It happens to match the already-documented (but
unimplemented) contract in `data-flow.md` ("control response → policy/profile metadata"; "ingest
request → sender_evidence … issuer candidate").

| Stage                     | Where                                          | Why                                                                                                            |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **1. Business recognition** | **Server, in the control step** (`requestIngestControl`) | Tenant is already resolved here; it has DB access to `suggestion_data`. Bind the recognized `businessId` into the grant and return its config. |
| **2. Treatment**          | **Gateway**, after control, driven by returned config | Only the gateway holds the raw MIME body; it is the network-facing tier for link-fetch + HTML→PDF rendering.   |
| **3. Persistence**        | **Server, in the ingest step** (`ingestEmail`) | Documents inserted under the `businessId` bound in the grant — never trusted from gateway input.               |

**Trust anchor:** the recognized `businessId` is written into the grant row at control time and read
back from the consumed grant at ingest time. The gateway never *asserts* which business a document
belongs to — it only *triggers* recognition by supplying sender evidence. This preserves the v2 rule
that a control-plane gateway cannot attribute documents to an arbitrary business/tenant.

### Sequence (target)

```
Cloudflare ──raw MIME──▶ Gateway
                          │ 1. parse MIME → documents + body + sender evidence (incl. issuer candidates)
                          ▼
                        Server control: resolveAlias → tenant
                                         recognize business (suggestion_data) under tenant RLS
                                         bind business_id into grant
                          ◀──grant + businessEmailConfig──
                          │ 2. treatment (gateway): attachment filter, body→PDF, internal-link fetch
                          ▼
                        Server ingest: validate+consume grant → read business_id from grant
                                        persist documents + charge under business_id
                          ◀──outcome──
```

---

## Workstream A — Server: business recognition in the control step

1. **Extend `EmailIngestionControlProvider`** (`email-ingestion-control.provider.ts`):
   - After `resolveAlias` → tenant, run recognition **under the tenant's RLS context** via the
     existing `withTenantContext(pool, tenantId, …)` helper.
   - ⚠️ Do **not** reuse `BusinessesProvider.getBusinessByEmail` directly — it queries through
     `TenantAwareDBClient`, which has no auth session in the gateway-CP context (the same limitation
     the ingest provider already documents). Add a raw-pool query mirroring its SQL
     (`WHERE suggestion_data->'emails' ? $email`).
   - Parse `suggestion_data` with the existing `suggestionDataSchema` helper (reused from the legacy
     resolver) → `emailListener` config.
   - Persist `business_id` into the grant (Workstream E).
2. **Issuer-selection policy lives server-side** (single source of truth, DB-aware, testable). Port
   the legacy `getIssuerEmail` logic (`gmail-service.ts` ~404-435): the invoice-provider skip-list
   (`notify@morning.co`, `c@sumit.co.il`, `ap@the-guild.dev`), the self-issued skip
   (`SOFTWARE PRODUCTS GUILDA LTD`), and the `originalFrom → from → replyTo` fallback chain. Input =
   sender evidence + body-derived `mailto:` candidates from the gateway; output = the email passed to
   the business lookup.
3. **No-match path:** return `businessId: null` with empty config → the gateway applies the legacy
   default (render body as PDF). Preserves the `!businessId` branch in `gmail-service.ts`.
4. Update the `requestIngestControl` resolver to accept sender evidence and return the config block.

## Workstream B — Gateway: enrich extraction & sender evidence

1. **`mime-extractor.ts`:** additionally capture the email **body** (prefer `text/html`, fall back to
   `text/plain` — port `getEmailBody`) and scan it for `From: <mailto:…>` candidates. Extend
   `SenderEvidence` / `ExtractionResult` to carry the body and the candidate issuer emails. (Today it
   extracts only header-based `from`/`replyTo`/`originalFrom`/`forwardedTo` and discards the body.)
   The retained body is **required** downstream for both body→PDF and internal-link fetching, so the
   parse step must keep it and must **not** emit a `NO_DOCUMENTS` verdict (see Quarantine timing).
2. **`orchestrator.ts` (Step 1):** thread sender evidence into the `requestControl` call.

## Workstream C — Gateway: the treatment step (new modules)

Duplicate-and-adapt from legacy `gmail-service.ts` (per `architecture-plan.md`: no shared runtime;
duplicate and adapt). After control returns config, build the final document set:

1. **Attachment filter** — keep attachments whose type is in `config.attachments` (port
   `gmail-service.ts` ~467-483, including the `octet-stream`+`.pdf` normalization).
2. **`html-to-pdf.ts`** — if `businessId` is null **or** `config.emailBody === true`, render the body
   → PDF via **bundled Chromium/Playwright** (port `convertHtmlToPdf`, including the `inline-css`
   step). Reuse a single shared browser instance across requests to bound memory.
3. **`link-fetcher.ts`** — some provider emails carry the document only as a **URL in the body**, not
   as an attachment; `config.internalEmailLinks` names which link to follow. This is therefore a
   *post-recognition treatment artifact*, never a MIME-extraction artifact (a hyperlink is not a MIME
   part, and you can't know which link to fetch until recognition returns `internalEmailLinks`). For
   each pattern, scan the **retained body** for a matching `<a href>`, fetch it, and convert to a
   PDF/document (port `getLinkFromBody` + `innerLinkDocumentFetcher`). These are public vendor
   "download your invoice" links (legacy fetches them unauthenticated), so egress belongs in the
   gateway. **Harden the SSRF surface:** keep the host+path allowlist match, and add
   private-IP/redirect blocking, a content-type allowlist, and size caps.
4. Assemble the final document set, **then** decide emptiness (see Quarantine timing) and call ingest
   (Step 2).

## Workstream D — Document bytes transport & persistence

The **central open gap:** v2 moves no bytes today, and treatment *creates* new bytes (body-PDF,
link-fetched PDFs) that exist only in the gateway. Transport options (**resolved → Option B**):

- **Option A (recommended): gateway uploads to blob storage, passes refs.** The gateway uploads each
  final document to the store the server already uses (Cloudinary, via
  `getDocumentFromFile`/`uploadToCloudinary`) or a staging bucket, then sends
  `{ hash, sizeBytes, mimeType, filename, storageRef }` to ingest. Keeps large payloads off the
  GraphQL mutation and keeps Chromium output off the server. Cost: the gateway needs scoped storage
  credentials (or a server-issued upload token in the grant).
- **Option B (simplest parity): inline bytes to the server.** The gateway base64-encodes documents
  into the ingest mutation; the server uploads via the existing `getDocumentFromFile`. Maximal reuse
  of the `insertEmailDocuments` logic and the cleanest trust model (the gateway never touches
  storage), but heavy payloads through the CP-token path.

Then **replace the ingest `TODO`** (`email-ingestion-ingest.provider.ts`): read `businessId` from the
consumed grant, and under `withTenantContext` generate a charge (`ChargesProvider.generateCharge`)
and insert documents (`DocumentsProvider.insertDocuments`) linked to it — mirroring the existing
`insertEmailDocuments` resolver, including the dedup-by-hash skip.

## Workstream E — DB & GraphQL contract changes

- **Migration:** add `business_id uuid NULL` (FK → `financial_entities`) to `email_ingestion_grants`
  (new action file alongside `2026-06-10T11-00-00.add-email-ingestion-grants.ts`); add a migration
  test.
- **typeDefs** (`email-ingestion.graphql.ts`): `IngestControlInput` gains `senderEvidence`;
  `IngestControlDecision` gains a `businessEmailConfig`/`profile` block (`businessId`, `emailBody`,
  `attachments`, `internalEmailLinks`); the `IngestEmailInput` document entries gain the content
  ref / inline field. **Do not** add a client-settable `businessId` to the ingest input.
- **Regenerate:** `yarn generate` (server types) + the gateway's `gql/` from `mutations.ts`.
- Update the gateway `server-client.ts` `ControlInput` / `ControlDecision` / `IngestInput` types and
  the mutation documents.

## Cross-cutting concerns

- **Quarantine timing (`NO_DOCUMENTS`):** the verdict must move from MIME-extraction time to
  *post-treatment* time. An email whose only document is behind a URL (or **is** the body) has zero
  MIME attachment parts and would be wrongly dropped if `extractFromMime` still returned
  `NO_DOCUMENTS` (as it does today at `mime-extractor.ts:60-62`). Legacy only declared "no relevant
  documents" after attachments + body→PDF + link-fetch (`gmail-service.ts:505`). So the pre-control
  parse must stop emitting the verdict; the gateway decides emptiness after treatment, and the server
  ingest keeps a zero-document quarantine as a backstop.
- **Grant TTL vs. treatment time:** the grant clock starts at control, but treatment (Chromium render
  + multiple link fetches) runs *before* ingest. The 5-minute TTL must comfortably cover that, or
  recognition should be split from grant issuance. (Risk.)
- **Derived-document dedup:** `idempotencyKey = rawMessageHash` is stable (good). But body-PDF /
  link-fetched bytes may not be byte-stable (e.g., PDF timestamps), which would break per-document
  hash dedup. Define a deterministic content hash, or dedup derived documents on their source (body
  hash / link URL).
- **Parity tests** (`architecture-plan.md`: "parity enforced by tests"): run representative fixtures —
  attachment-only, body-as-PDF provider, internal-link provider, unrecognized sender,
  provider-skip-list cases — through both the legacy and v2 paths and compare the resulting documents
  and charges. Keep shadow mode until parity holds.
- **Docs:** update `data-flow.md` and `architecture-plan.md` to show recognition-in-control and
  treatment-in-gateway.

## Decisions

All resolved.

1. **Bytes transport → Option B (inline → server).** The gateway base64-encodes each final document
   into the ingest mutation; the server uploads via the existing `getDocumentFromFile`, reusing the
   `insertEmailDocuments` path. Chosen for trust-model simplicity — the gateway never touches storage.
   Payload size is bounded by the existing MIME caps.
2. **HTML→PDF runtime → bundled Chromium (Playwright) in the gateway.** The `/webhook` path (parse +
   orchestrate + treatment) runs in the Node HTTP service (`index.ts`, `node:http`), not the
   Cloudflare Worker (`worker.ts` is only the Email forwarder), so a headless browser is viable.
   Chosen to match the legacy `convertHtmlToPdf` output for the test-enforced parity requirement —
   provider invoice emails are CSS-heavy, and a lighter renderer would risk fidelity/parity
   regressions. Cost: a larger gateway image + render-time CPU/memory; mitigate with a shared browser
   instance and the existing size caps. (A separate render service was rejected as unnecessary
   operational overhead.)
3. **Issuer detection → split: gateway extracts candidates, server selects.** The gateway parses the
   body for `From: <mailto:…>` candidates and forwards them alongside the header-based sender
   evidence; the server owns the selection policy (skip-lists, `originalFrom → from → replyTo`
   fallback) next to the `getBusinessByEmail` lookup it feeds. Keeps business-matching as one
   DB-aware, testable source of truth; the gateway does only the body parsing it alone can do.

## Rough effort

Medium-large.

- Server recognition + persistence (A, D, E): ~2-3 days.
- Gateway extraction + treatment modules (B, C), incl. a renderer: ~3-4 days.
- Contracts/codegen + parity/shadow tests + docs: ~2-3 days.
- Plus first-time Chromium/Playwright setup in the gateway image (bundling + the browser binary),
  which adds image-build and memory overhead.

## Implementation checklist

- [ ] A. Server: raw-pool business recognition under tenant RLS in `EmailIngestionControlProvider`
- [ ] A. Server: port issuer-selection policy (skip-lists + fallback chain)
- [ ] A. Server: `requestIngestControl` accepts sender evidence, returns config
- [ ] B. Gateway: `mime-extractor` captures body + `mailto:` candidates; extend sender evidence
- [ ] B. Gateway: `orchestrator` passes sender evidence to control
- [ ] B. Gateway: parse stops emitting `NO_DOCUMENTS`; emptiness decided post-treatment
- [ ] C. Gateway: attachment filter
- [ ] C. Gateway: `html-to-pdf` module (bundled Chromium/Playwright, shared browser instance)
- [ ] C. Gateway: `link-fetcher` module (SSRF-hardened)
- [ ] D. Implement bytes transport — Option B (inline base64 → server `getDocumentFromFile`)
- [ ] D. Server: replace ingest `TODO` with charge + document persistence under grant `business_id`
- [ ] E. Migration: `email_ingestion_grants.business_id` (+ test)
- [ ] E. typeDefs + `yarn generate` (server + gateway gql)
- [ ] E. Update gateway `server-client` contracts + mutation documents
- [ ] Parity/shadow tests across both paths
- [ ] Update `data-flow.md` / `architecture-plan.md`
- [ ] Deprecate legacy `businessEmailConfig` / `insertEmailDocuments` after cutover
