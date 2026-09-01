# Email Ingestion Gateway Package

V2 multi-tenant email→document ingestion. Receives raw MIME (relayed by a Cloudflare Email Worker),
verifies authenticity, parses documents, recognizes the issuing business, and calls the Accounter
GraphQL server to persist them.

See [`README.md`](./README.md) for the full overview and
[`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) for diagnosing failed/quarantined emails.

## Two runtimes, one package

- `src/worker.ts` — **Cloudflare Worker**. Thin: HMAC-signs the raw MIME and POSTs it to the
  gateway; forwards to `FALLBACK_EMAIL` if the gateway is down. Runs on the Workers runtime
  (`wrangler`).
- `src/index.ts` — **Node.js gateway service**. The HTTP server (`/health`, `/readiness`,
  `POST /webhook`) that does all the real work. Needs Chromium (Playwright) for body→PDF.

Keep the Worker minimal and secret-free beyond the shared HMAC key — all logic belongs in the
gateway.

## Module map (`src/`)

| File                   | Responsibility                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `index.ts`             | HTTP server, routing, correlation-id setup, prod kill-switch on missing secret.                     |
| `worker.ts`            | Cloudflare `email()` handler: sign + POST, health-probe fallback to forward.                        |
| `webhook.ts`           | `/webhook` handler: flag gate → header validation → body read → verify → parse → orchestrate.       |
| `verifier.ts`          | Authenticity: IP allowlist, timestamp window, HMAC-SHA256, in-memory nonce replay store.            |
| `mime-extractor.ts`    | `postal-mime` parsing → documents + sender evidence + body; size/count/depth guards.                |
| `forwarded.ts`         | Structural parsing of quoted `---------- Forwarded message ---------` blocks (nested, text + HTML). |
| `orchestrator.ts`      | control → treatment → ingest sequence; the core flow.                                               |
| `treatment.ts`         | Build the final document set: attachment filter + body→PDF + internal-link fetch.                   |
| `link-fetcher.ts`      | Fetch documents behind configured links, with SSRF hardening.                                       |
| `html-to-pdf.ts`       | Render HTML body → PDF via headless Chromium (JS disabled), shared browser instance.                |
| `server-client.ts`     | GraphQL client for `requestIngestControl` / `ingestEmail`, with timeouts + retries.                 |
| `environment.ts`       | `zod`-validated env; exits on invalid config.                                                       |
| `contracts.ts`         | `IngestOutcome` / `IngestReasonCode` constants (duplicated from server, parity-tested).             |
| `logger.ts`            | Structured JSON logging + correlation-id generation.                                                |
| `graphql/mutations.ts` | The two GraphQL mutation documents the client sends.                                                |

## Conventions

- **ESM only**, with `.js` import suffixes on relative paths (even in `.ts` source) — repo-wide
  rule.
- **No CommonJS**, no `require`.
- TypeScript strict mode.
- **Always use `yarn`** (never npm/npx/pnpm). Run scripts via
  `yarn workspace @accounter/email-ingestion-gateway <script>`.
- Structured logging only: call `log(level, message, fields, correlationId)` from `logger.ts`. Never
  `console.log` directly (the `logger` is the one exception, internally). Thread `correlationId`
  through every code path.
- I/O is **dependency-injected** for testability: `OrchestratorDeps`, `WebhookDeps`,
  `TreatmentDeps`, `ServerClientDeps`, and a pluggable `NonceStore` all accept overrides so tests
  avoid Chromium and the network. Preserve this — don't hard-wire `fetch`/Chromium/clock into logic.
- The `currentTimeSeconds` / `sleep` clocks are injectable; don't call `Date.now()` directly in
  verifiable logic paths.

## Generated code

- `src/gql/` is **generated** by `graphql-codegen` (root `yarn generate:graphql`) and git-ignored.
  Never edit it by hand. `server-client.ts` imports its operation types from `./gql/index.js`.
- After changing the server's email-ingestion typeDefs or the mutation documents in
  `graphql/mutations.ts`, re-run `yarn generate:graphql`.

## Contract parity with the server

`contracts.ts` here and `packages/server/src/modules/email-ingestion/contracts.ts` are **deliberate
duplicates** (no runtime import across packages). If you change an outcome or reason code, change
**both** and keep the parity tests (`treatment.parity.test.ts` here, plus the server's contract
tests) green.

The wire contract is the two GraphQL mutations (`requestIngestControl`, `ingestEmail`) owned by the
server's `email-ingestion` module. The gateway sends `senderEvidence` on **control** (business
recognition is server-side) and never sends a client-chosen `businessId` — the issuing business is
read back from the grant.

## Security invariants (don't regress)

- Verify **before** consuming the nonce (avoid replay-store pollution); verify auth **before** any
  heavy work.
- Idempotency/dedup keys derive from the gateway-computed `rawMessageHash`, never the
  sender-controlled `Message-ID`.
- Internal-link fetching keeps the SSRF guard stack in `link-fetcher.ts` (host/path allowlist,
  private-IP + resolved-IP block, http(s)-only, `redirect: 'error'`, content-type allowlist,
  streamed size cap). Don't loosen any of these without review.
- Body HTML renders with `javaScriptEnabled: false`.
- `CF_WEBHOOK_SECRET` is required in production (`index.ts` throws on startup if missing).

## Testing

```bash
# from repo root
yarn test --project unit packages/email-ingestion-gateway
```

Tests live in `src/__tests__/`. When adding behavior, inject stubs via the `*Deps` interfaces rather
than reaching for global mocks; follow the existing suites (`orchestrator.test.ts`,
`webhook.test.ts`, `worker-pipe.integration.test.ts`).

`src/__tests__/fixtures/*.eml` are **hand-authored** with fictional addresses, one per real-world
header shape (Google-Group relay, invoice-platform relay, nested manual forward, RFC 2047 Hebrew
encoded-words). `example-docs/` is git-ignored: it holds real captured messages with real vendor
addresses, DKIM signatures and real invoice PDFs. Use it locally with `inspect:eml` (add `--json` to
get the exact `senderEvidence` payload sent to `requestIngestControl`), never in a committed test.
`replay:eml` re-drives one of those captured messages through the _real_ pipeline (control →
treatment → ingest); it is the recovery step for an email that was lost, and is safe to re-run
because idempotency keys on `rawMessageHash`.

## Commands

```bash
yarn workspace @accounter/email-ingestion-gateway dev           # gateway service (tsx watch)
yarn workspace @accounter/email-ingestion-gateway build         # tsc → dist/
yarn workspace @accounter/email-ingestion-gateway typecheck     # tsc --noEmit
yarn workspace @accounter/email-ingestion-gateway worker:dev    # wrangler dev (Worker)
yarn workspace @accounter/email-ingestion-gateway worker:deploy # wrangler deploy
yarn workspace @accounter/email-ingestion-gateway inspect:eml <f>  # what the extractor sees
yarn workspace @accounter/email-ingestion-gateway replay:eml <f>   # re-drive a captured message
yarn generate:graphql                                           # regenerate src/gql/
```
