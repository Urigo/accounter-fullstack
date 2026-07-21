# @accounter/email-ingestion-gateway

## 0.1.1

### Patch Changes

- [#3926](https://github.com/Urigo/accounter-fullstack/pull/3926)
  [`295fa80`](https://github.com/Urigo/accounter-fullstack/commit/295fa805843094115b58f291be309b86351ac96d)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Refine the email-ingestion-gateway
  container build. Rename `DockerFile` to `Dockerfile`, fix the `docker:build`/`docker:run`
  workspace scripts to use the correct build context (`../../`) and paths, copy only workspace
  manifests before `yarn install` for better layer caching, run the production stage as the non-root
  `pwuser` from the Playwright base image (copying artifacts with `--chown` instead of a costly
  recursive `chown -R /app`), and add a root `.dockerignore` so the repo-root build context stays
  small and host `node_modules` don't clobber the installed dependencies.

- [#3762](https://github.com/Urigo/accounter-fullstack/pull/3762)
  [`50ca939`](https://github.com/Urigo/accounter-fullstack/commit/50ca939661d9eb5b31e134c54d12015e524fac1c)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - Gateway: parse incoming MIME with
  `postal-mime` (as recommended by Cloudflare's email-handler docs) instead of the hand-rolled
  parser. This decodes RFC 2047 encoded-word headers, so non-ASCII subjects and sender display names
  (e.g. Hebrew `=?UTF-8?B?…?=`) are no longer stored as raw encoded strings — fixing the email
  charge description that reads them. `extractFromMime` keeps the same public contract
  (document-type filtering, size/count limits, nesting-depth guard, and the `From: <mailto:…>`
  issuer-candidate heuristic) and now also forwards the email subject to the server for the charge
  description.

- [#3873](https://github.com/Urigo/accounter-fullstack/pull/3873)
  [`246b1e4`](https://github.com/Urigo/accounter-fullstack/commit/246b1e4d41a6424c4b9f251ff0b8cf36c774ab30)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - **New `IngestReasonCode.SELF_ISSUED`**
  constant in both `contracts.ts` files (server and gateway): Distinguishes self-issued skips from
  content re-deliveries in duplicate outcomes.

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
