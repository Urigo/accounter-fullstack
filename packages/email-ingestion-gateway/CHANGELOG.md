# @accounter/email-ingestion-gateway

## 0.1.1

### Patch Changes

- [#3926](https://github.com/Urigo/accounter-fullstack/pull/3926) [`295fa80`](https://github.com/Urigo/accounter-fullstack/commit/295fa805843094115b58f291be309b86351ac96d) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Refine the email-ingestion-gateway container build. Rename `DockerFile` to `Dockerfile`, fix the
  `docker:build`/`docker:run` workspace scripts to use the correct build context (`../../`) and paths,
  copy only workspace manifests before `yarn install` for better layer caching, run the production
  stage as the non-root `pwuser` from the Playwright base image (copying artifacts with `--chown`
  instead of a costly recursive `chown -R /app`), and add a root `.dockerignore` so the repo-root
  build context stays small and host `node_modules` don't clobber the installed dependencies.

- [#4127](https://github.com/Urigo/accounter-fullstack/pull/4127) [`5bdeb5c`](https://github.com/Urigo/accounter-fullstack/commit/5bdeb5c61ef2ffc46d93e786cbd1afff0113c68d) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Fix email-ingestion falsely marking forwarded supplier invoices as self-issued (SELF_ISSUED
  DUPLICATE) and silently dropping them.
  
  When a supplier (e.g. Aiven) emails a tenant's Accounts-Payable Google Group, the mailing list
  rewrites the quoted `From:` to the group's own forwarding address (`'Aiven Billing' via Account
  Payables <ap@…>`). The real issuer's address survived only as a body contact/footer `mailto:` link,
  which the issuer-candidate extractor did not harvest — so the only recognized address was the
  forwarder, hard-coded as a self-issuing provider. The email was bound to the tenant's own business
  and skipped at ingest as a `DUPLICATE` (`SELF_ISSUED`), inserting nothing.
  
  - **Gateway `mime-extractor.ts`**: harvest any body `mailto:` link (not only header-anchored
    `From:`/`Reply-To:`/`Sender:` addresses) as lower-priority issuer candidates, so a real issuer
    reachable only through a contact/footer link is still recovered for server-side recognition.
  - **Server `email-ingestion-control.resolver.ts`**: a positive *external* business recognition now
    wins over the single-address self-issued heuristic. When recognition identifies a real
    counterparty (any business other than the tenant), the documents are attributed to it and the
    self-issued check is skipped, so a supplier invoice routed through the tenant's own forwarding
    group is no longer misclassified.
  - **Server `email-ingestion-ingest.provider.ts`**: the self-issued / tenant-matched path now
    **QUARANTINEs** (recorded, visible, reprocessable) instead of silently returning `DUPLICATE` with
    nothing written, so a misclassification is never silent data loss. The `SELF_ISSUED` reason code
    now pairs with the `QUARANTINED` outcome.

- [#4124](https://github.com/Urigo/accounter-fullstack/pull/4124) [`3f3c0bd`](https://github.com/Urigo/accounter-fullstack/commit/3f3c0bd2b29e6e7beaf370a41eb54cd87e5f10c0) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Fix v2 email ingestion stranding emails on a failed document upload. The server consumed the
  single-use grant in its own committed transaction before the fallible, non-transactional document
  preparation (Cloudinary upload, OCR), so any failure there left the grant burned with **nothing**
  persisted — no document, no charge, no quarantine, no idempotency record — and every retry then hit
  the already-consumed grant (`GRANT_INVALID` → `REJECTED`). The underlying error was also swallowed
  by the ingest resolver, making the failure invisible server-side.
  
  Now the server validates the grant read-only up front, prepares documents while the grant is still
  intact, and consumes the grant **atomically inside the write transaction**, so a failure rolls the
  consume back and the email stays retryable. A Cloudinary/prep failure is turned into a new
  `UPLOAD_FAILED` quarantine (recorded and reprocessable) instead of throwing raw, while unexpected
  errors still surface with the grant unconsumed. The ingest resolver now logs the real cause (keyed
  by `correlationId`) rather than returning a bare `CommonError`.

- [#4184](https://github.com/Urigo/accounter-fullstack/pull/4184) [`d6fa2d0`](https://github.com/Urigo/accounter-fullstack/commit/d6fa2d002226930e0bbd20fd3fced9543c03455a) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Classify incoming email as `DIRECT` / `RELAYED` / `FORWARDED` / `SELF_ISSUED` before recognizing an
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

- [#4356](https://github.com/Urigo/accounter-fullstack/pull/4356) [`129a4cd`](https://github.com/Urigo/accounter-fullstack/commit/129a4cd229d3b39ad28ee21f27bcaf86ace3b480) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Log the upstream error on a control/ingest denial instead of discarding it.
  
  `ServerClient.requestControl` / `requestIngest` returned a failure carrying both a `reason` code and
  a `message` holding the actual error string, and `orchestrator.ts` logged only the reason. The one
  field that distinguishes connection refused from a 4xx from a GraphQL error the server returned was
  the one not logged.
  
  Diagnosing the incident in [#4344](https://github.com/urigo/accounter-fullstack/issues/4344) therefore meant reconstructing which branch was taken from
  `durationMs` alone — comparing it against the retry policy's fixed 300 ms backoff floor to prove the
  failure had not been retried, and so that the server had answered rather than refused. That should
  be a single glance at a log line.
  
  `orchestrate:control:denied` and `orchestrate:ingest:failed` now carry:
  
  - `upstreamMessage` — the error text. Named `upstreamMessage` rather than `message` because `log()`
    spreads `fields` and then sets its own `message`, so a field by that name is silently overwritten.
  - `status` — the HTTP status when the server answered, so 200-with-GraphQL-errors is distinguishable
    from a 4xx and from a transport failure without parsing strings.
  - `attempts` — the actual attempt count from `withRetry`, which removes the need to infer it from
    timing.
  
  `String(err)` on a `graphql-request` `ClientError` embeds the whole response body, which can be a
  multi-kilobyte HTML error page from a proxy. A `ClientError` is now reduced to its status plus the
  GraphQL error messages, and every error string is truncated at 500 characters.
  
  Also silences the dotenv banner printed on every gateway boot:
  
  ```
  failed to load /app/packages/email-ingestion-gateway/.env ENOENT: no such file or directory
  ◇ injected env (0) from .env
  ```
  
  In the deployed container the environment comes from the platform and there is no `.env`, so this is
  expected — but it reads as an error at the top of an incident log. The old gate
  (`debug: process.env.RELEASE ? false : true`) depended on `RELEASE`, which is not actually set in
  the deployment; dotenv diagnostics are now opt-in via `DOTENV_DEBUG=1`.

- [#4356](https://github.com/Urigo/accounter-fullstack/pull/4356) [`129a4cd`](https://github.com/Urigo/accounter-fullstack/commit/129a4cd229d3b39ad28ee21f27bcaf86ace3b480) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Split `UPSTREAM_ERROR` out of `TRANSIENT_UPSTREAM`, and widen the control retry budget.
  
  **The reason code was a catch-all.** `classifyFinalError` bucketed everything that was not a timeout
  into `TRANSIENT_UPSTREAM`, so one code covered connection refused, DNS failure, TLS failure, any
  5xx, any 4xx, every GraphQL error the server returned, and an empty response body. Two of those are
  not transient at all: an HTTP 200 carrying a GraphQL `errors[]` array (how a server-side exception
  surfaces through yoga) and a 4xx such as a misconfigured `GATEWAY_CP_TOKEN`. Both were reported as a
  passing cloud, and an operator reading `TRANSIENT_UPSTREAM` would reasonably assume they would fix
  themselves. In the incident behind [#4344](https://github.com/urigo/accounter-fullstack/issues/4344) the same signature recurred five times in two days and the
  label actively slowed diagnosis.
  
  `UPSTREAM_ERROR` now covers "the server answered and said no". `TRANSIENT_UPSTREAM` keeps the
  transport failures and 5xx — a 5xx is the server failing rather than refusing, and is expected to
  clear. `TIMEOUT` is unchanged. Added to both `contracts.ts` files with the parity tests updated
  together, per the package convention.
  
  `isRetryable` also stops keying purely on `status >= 500`: 408/425/429 are explicit "come back
  later" statuses and are now retried, while every other 4xx stays terminal.
  
  **The control retry budget was ~0.3 s.** `CONTROL_MAX_RETRIES = 2` with a 100 ms base gave backoff
  of 100 ms then 200 ms — a 300 ms total sleep sitting under a 3000 ms per-attempt timeout, orders of
  magnitude tighter than the timeout it guarded. Control is explicitly side-effect-free before
  `issueGrant`, so that headroom was going unused.
  
  Max retries is now 4 with a 250 ms base (250/500/1000/2000 ms), plus 25 % additive jitter so a burst
  of arrivals — the logs show 6 webhooks within 2 s — does not retry in lockstep. The jitter source is
  injectable, so backoff stays deterministic under test.
  
  Ingest is deliberately untouched: `INGEST_MAX_RETRIES = 1` with `retryOnTimeout = false` is correct,
  since the grant is single-use and a retry burns it.
  
  Also routes a null `data` (a 200 whose body does not match the contract) into `UPSTREAM_ERROR`
  rather than letting a `TypeError` fall through and be classified as a transport failure.

- [#4356](https://github.com/Urigo/accounter-fullstack/pull/4356) [`129a4cd`](https://github.com/Urigo/accounter-fullstack/commit/129a4cd229d3b39ad28ee21f27bcaf86ace3b480) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Return non-2xx from `/webhook` when orchestration leaves no durable record, so the Worker's
  `FALLBACK_EMAIL` path actually fires.
  
  `worker.ts` has a designed no-loss path: if the gateway rejects the request, forward the email to
  the legacy mailbox rather than dropping it.
  
  ```ts
  if (!response.ok) {
    if (env.FALLBACK_EMAIL) {
      await message.forward(env.FALLBACK_EMAIL)
      return
    }
    throw new Error('Gateway returned status ' + response.status)
  }
  ```
  
  But `webhook.ts` answered `202` even when orchestration failed, and `202` satisfies `response.ok` —
  so the Worker treated a total-loss outcome as success and the fallback branch was unreachable for
  every orchestration failure. The `failed: true` flag in the body was never read. This is one of the
  four gaps that turned a sub-second upstream blip into five permanently lost emails ([#4344](https://github.com/urigo/accounter-fullstack/issues/4344)).
  
  The status is now decided per reason code rather than by outcome shape:
  
  - `TRANSIENT_UPSTREAM`, `UPSTREAM_ERROR`, `TIMEOUT` — control never granted, so there is no resolved
    tenant, and `email_ingestion_quarantine` requires one. Nothing was recorded and nothing can be.
    **503**, so the Worker forwards.
  - `UNKNOWN_ALIAS` — the mail is undeliverable to any tenant. Forwarding it to a human beats dropping
    it. **503**.
  - `GRANT_INVALID` and the other post-grant failures — these _are_ recorded server-side
    (quarantine/audit rows exist) and are reprocessable, so **202** stays correct; forwarding them
    would duplicate work.
  
  Shadow mode (`EMAIL_INGESTION_SHADOW_MODE=1`) responds `202` before orchestration runs, so it cannot
  participate and is left as-is.
  
  The mapping is an exported `statusForOrchestrationFailure(reason)` with a test per reason code, and
  `worker-pipe.integration.test.ts` gains an end-to-end case asserting that a control call returning a
  GraphQL error drives the Worker down the `FALLBACK_EMAIL` branch.

- [#3762](https://github.com/Urigo/accounter-fullstack/pull/3762) [`50ca939`](https://github.com/Urigo/accounter-fullstack/commit/50ca939661d9eb5b31e134c54d12015e524fac1c) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Gateway: parse incoming MIME with `postal-mime` (as recommended by Cloudflare's email-handler docs)
  instead of the hand-rolled parser. This decodes RFC 2047 encoded-word headers, so non-ASCII subjects
  and sender display names (e.g. Hebrew `=?UTF-8?B?…?=`) are no longer stored as raw encoded strings —
  fixing the email charge description that reads them. `extractFromMime` keeps the same public contract
  (document-type filtering, size/count limits, nesting-depth guard, and the `From: <mailto:…>`
  issuer-candidate heuristic) and now also forwards the email subject to the server for the charge
  description.

- [#3873](https://github.com/Urigo/accounter-fullstack/pull/3873) [`246b1e4`](https://github.com/Urigo/accounter-fullstack/commit/246b1e4d41a6424c4b9f251ff0b8cf36c774ab30) Thanks [@gilgardosh](https://github.com/gilgardosh)! - - **New `IngestReasonCode.SELF_ISSUED`** constant in both `contracts.ts` files (server and gateway):
    Distinguishes self-issued skips from content re-deliveries in duplicate outcomes.

## 0.1.0

### Minor Changes

- [#3743](https://github.com/Urigo/accounter-fullstack/pull/3743)
  [`7cc5c7d`](https://github.com/Urigo/accounter-fullstack/commit/7cc5c7d10015fafec12c3c3fe1e8c6d4d04b19c9)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Email ingestion v2 — document bytes
  transport & persistence (Workstream D).

  The gateway now inlines each treated document's bytes (base64, Option B) into the `ingestEmail`
  mutation, and the server ingest step persists them: under the grant tenant's RLS context it
  uploads each document to Cloudinary, creates a charge, and inserts the documents — attributed to
  the recognized issuing business (read back from the grant's `business_id`, never trusted from
  gateway input) as the document counterparty, with the legacy per-document hash dedup skip.
  Documents are stored as `UNPROCESSED` (classification/OCR happens later via the normal flow).

  Because the gateway control-plane caller has no auth session, persistence uses inline,
  tenant-pinned SQL rather than the auth-coupled `DocumentsProvider` / `ChargesProvider` /
  `getDocumentFromFile` (the same constraint behind the existing idempotency/dedup/quarantine
  writes). Metadata-only ingest calls (no inline bytes) remain a no-op for persistence.

- [#3743](https://github.com/Urigo/accounter-fullstack/pull/3743)
  [`7cc5c7d`](https://github.com/Urigo/accounter-fullstack/commit/7cc5c7d10015fafec12c3c3fe1e8c6d4d04b19c9)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Gateway treatment step (Workstream C):
  after the server recognizes the issuing business, the gateway now assembles the final document set
  from the returned `businessEmailConfig` — filtering attachments by the allowed types, rendering
  the email body to a PDF (bundled Chromium via Playwright) when no business is recognized or
  `emailBody` is enabled, and fetching documents from configured `internalEmailLinks` in the body
  (SSRF-hardened: host/path allowlist, private-IP/redirect blocking, content-type allowlist, size
  caps). Orchestration runs treatment between control and ingest, so the document set (and
  emptiness) is decided post-recognition.

  Note: the gateway runtime must provide a Chromium binary (e.g.
  `playwright install --with-deps chromium`). Document bytes are still transported as metadata only
  — inline byte transport and server-side persistence land in Workstream D.

### Patch Changes

- [#3743](https://github.com/Urigo/accounter-fullstack/pull/3743)
  [`7cc5c7d`](https://github.com/Urigo/accounter-fullstack/commit/7cc5c7d10015fafec12c3c3fe1e8c6d4d04b19c9)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Gateway: capture the email body and issuer
  (`From: <mailto:…>`) candidates during MIME extraction, and forward sender evidence to the control
  endpoint so the server can recognize the issuing business (Workstream B). Attachment-less emails
  are no longer treated as an extraction failure — the body may still yield a document during
  treatment, so emptiness is decided later with the server ingest as the backstop.

- [#3651](https://github.com/Urigo/accounter-fullstack/pull/3651)
  [`d4b5bb5`](https://github.com/Urigo/accounter-fullstack/commit/d4b5bb5a7c969c4112720b0e772dd988e46d8e98)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - **Multi-tenant Email Ingestion
  Architecture**: Implemented a new v2 email ingestion pipeline routing inbound mail through
  Cloudflare Email to a private Gateway, with authoritative tenant resolution and data persistence
  handled by the Server.
  - **Security and Authenticity**: Added cryptographic authenticity verification (HMAC-SHA256) for
    Cloudflare-to-Gateway requests, alongside nonce-based replay protection and IP allowlisting.
  - **Greenfield Gateway Service**: Scaffolded a new, independent `packages/email-ingestion-gateway`
    service that avoids runtime coupling with the legacy `gmail-listener` package.
