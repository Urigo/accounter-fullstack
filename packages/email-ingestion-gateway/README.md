# Email Ingestion Gateway

The **email-ingestion-gateway** is the v2 multi-tenant entry point for turning inbound emails into
accounting documents. It receives raw MIME messages (relayed from a Cloudflare Email Worker), proves
they are authentic, parses out candidate documents, recognizes the issuing business, and hands the
final document set to the Accounter GraphQL server for tenant-scoped persistence.

It replaces the single-tenant [`gmail-listener`](../gmail-listener) polling approach with a
push-based, authenticated, multi-tenant pipeline.

> For the design rationale, threat model, and rollout plan see
> [`docs/multi-tenant-gmail-listener/`](../../docs/multi-tenant-gmail-listener/):
> [architecture-plan](../../docs/multi-tenant-gmail-listener/architecture-plan.md),
> [data-flow](../../docs/multi-tenant-gmail-listener/data-flow.md),
> [security-architecture-review](../../docs/multi-tenant-gmail-listener/security-architecture-review.md),
> and the
> [cloudflare-setup-runbook](../../docs/multi-tenant-gmail-listener/cloudflare-setup-runbook.md).

## Two deployable units

This package ships **two** runtimes built from the same source tree:

| Unit                  | Entry point     | Runtime              | Role                                                                                                                                                   |
| --------------------- | --------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cloudflare Worker** | `src/worker.ts` | Cloudflare Workers   | Receives the `email()` event, HMAC-signs the raw MIME, and `POST`s it to the gateway. Falls back to forwarding if the gateway is unreachable.          |
| **Gateway service**   | `src/index.ts`  | Node.js (Playwright) | HTTP server that verifies authenticity, parses MIME, runs treatment (body→PDF, link fetch), and calls the server's GraphQL control + ingest mutations. |

The Worker is intentionally thin: it does no parsing and holds no secrets beyond the shared HMAC
key. All business logic lives in the gateway service.

## Pipeline at a glance

```
Inbound email
  │
  ▼
Cloudflare Email Worker (src/worker.ts)
  │  HMAC-SHA256 sign  →  POST /webhook  (raw MIME as body, metadata in x-cf-* headers)
  ▼
Gateway service (src/index.ts → src/webhook.ts)
  │  1. feature-flag gate (EMAIL_INGESTION_V2_ENABLED)
  │  2. authenticity verify (IP allowlist + timestamp + HMAC + nonce replay)  → src/verifier.ts
  │  3. compute rawMessageHash (sha256 of body) + parse MIME                  → src/mime-extractor.ts
  ▼
Orchestrator (src/orchestrator.ts)
  │  4. control mutation  → resolve tenant from alias, recognize business, get single-use grant
  │  5. treatment         → attachment filter + body→PDF + internal-link fetch   → src/treatment.ts
  │  6. ingest mutation   → server validates grant, dedups, persists (or quarantines)
  ▼
Accounter GraphQL server (packages/server, module: email-ingestion)
```

The server side of this contract lives in
[`packages/server/src/modules/email-ingestion`](../server/src/modules/email-ingestion). The two
`requestIngestControl` and `ingestEmail` mutations are defined there.

## HTTP API

The gateway service exposes three routes (see `src/index.ts`):

| Method | Path         | Purpose                                                            |
| ------ | ------------ | ------------------------------------------------------------------ |
| `GET`  | `/health`    | Liveness probe — always `200 {"status":"ok"}`.                     |
| `GET`  | `/readiness` | Readiness probe — `200 {"ready":true}`.                            |
| `POST` | `/webhook`   | Main ingestion endpoint. Expects raw MIME body + `x-cf-*` headers. |

### `POST /webhook` request contract

| Header             | Required | Meaning                                                   |
| ------------------ | -------- | --------------------------------------------------------- |
| `x-cf-timestamp`   | yes      | Unix epoch **seconds** the request was signed.            |
| `x-cf-signature`   | yes      | Hex HMAC-SHA256 of `` `${timestamp}.${rawBody}` ``.       |
| `x-cf-nonce`       | yes      | Unique per-request value (replay protection).             |
| `x-cf-recipient`   | yes      | The tenant alias the mail was addressed to.               |
| `x-cf-message-id`  | yes      | Upstream `Message-ID`.                                    |
| `x-cf-received-at` | no       | ISO-8601 received time (used for the charge description). |
| `x-correlation-id` | no       | Propagated through all logs; generated if absent.         |

The body is the **raw MIME message** (`Content-Type: message/rfc822`). The gateway — not the Worker
— computes the authoritative `rawMessageHash` from the signed body.

The endpoint always responds `202 Accepted` once authenticity passes; the ingest `outcome`
(`INSERTED` / `DUPLICATE` / `QUARANTINED` / `REJECTED`) is included in the JSON body in production
mode. Authenticity failures return `401`, malformed requests `400`, oversize bodies `413`.

## Configuration

Configuration is validated by `zod` at startup (`src/environment.ts`); invalid values exit the
process with code `1`.

### Gateway service env (`.env` in the package root)

| Variable                      | Default                 | Description                                                                                     |
| ----------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `PORT`                        | `3000`                  | HTTP listen port.                                                                               |
| `EMAIL_INGESTION_V2_ENABLED`  | `0`                     | `1` enables `/webhook`; `0` returns `503`. Master kill-switch.                                  |
| `EMAIL_INGESTION_SHADOW_MODE` | `0`                     | `1` = run orchestration async and respond immediately (legacy path stays authoritative).        |
| `CF_WEBHOOK_SECRET`           | _(none)_                | Shared HMAC-SHA256 secret. **Required in production** (startup throws otherwise).               |
| `CF_IP_ALLOWLIST`             | `''` (disabled)         | Comma-separated source IPs / IPv4 CIDRs. Empty disables the IP check.                           |
| `GATEWAY_SERVER_URL`          | `http://localhost:4000` | Base URL of the Accounter GraphQL server (`/graphql` is appended).                              |
| `GATEWAY_CP_TOKEN`            | `''`                    | Shared secret sent as `X-Gateway-CP-Token` to authenticate as the `gateway_control_plane` role. |

> Set `TEST_ENV_FILE` to load an alternate dotenv file (used by tests).

### Cloudflare Worker env (`.dev.vars` / Wrangler secrets)

See [`.dev.vars.example`](./.dev.vars.example):

| Variable            | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `CF_WEBHOOK_SECRET` | Must match the gateway's secret — the Worker signs, the gateway verifies. |
| `GATEWAY_URL`       | URL the Worker `POST`s the webhook to.                                    |
| `FALLBACK_EMAIL`    | Address the Worker forwards to when the gateway is unreachable.           |

## Local development

```bash
# Install (from repo root — always use yarn)
yarn install

# Generate the GraphQL types this package consumes (writes src/gql/)
yarn generate:graphql

# Run the gateway service in watch mode (tsx)
yarn workspace @accounter/email-ingestion-gateway dev

# Run the Cloudflare Worker locally (wrangler)
yarn workspace @accounter/email-ingestion-gateway worker:dev
```

A minimal local `.env`:

```sh
EMAIL_INGESTION_V2_ENABLED=1
CF_WEBHOOK_SECRET=local-secret
GATEWAY_SERVER_URL=http://localhost:4000
GATEWAY_CP_TOKEN=local-cp-token
```

`GATEWAY_CP_TOKEN` must match the server's `GATEWAY_CP_TOKEN` so the gateway can authenticate as the
`gateway_control_plane` role.

### Sending a test webhook

The signature covers `` `${timestamp}.${rawBody}` ``. Example with `openssl`:

```bash
SECRET=local-secret
TS=$(date +%s)
BODY=$(cat fixture.eml)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -sS http://localhost:3000/webhook \
  -H "Content-Type: message/rfc822" \
  -H "x-cf-timestamp: $TS" \
  -H "x-cf-signature: $SIG" \
  -H "x-cf-nonce: $(uuidgen)" \
  -H "x-cf-recipient: invoices@acme.example.com" \
  -H "x-cf-message-id: <test-1@example.com>" \
  --data-binary @fixture.eml
```

## Testing

```bash
# Unit tests (vitest) for this package
yarn workspace @accounter/email-ingestion-gateway test # if defined, else from root:
yarn test --project unit packages/email-ingestion-gateway
```

Notable suites (`src/__tests__/`):

- `verifier.test.ts` — HMAC / timestamp / IP allowlist / nonce replay.
- `mime-extractor.test.ts` — MIME parsing, document detection, size/count guards.
- `treatment.test.ts` / `treatment.parity.test.ts` — treatment logic and parity with the legacy
  listener.
- `orchestrator.test.ts` — control → treatment → ingest flow with mocked server client.
- `worker-pipe.integration.test.ts` — end-to-end Worker → gateway → mocked server.
- `link-fetcher.test.ts` — SSRF guards for internal-link fetching.

## Building & deployment

```bash
# Gateway service (Node) — tsc to dist/
yarn workspace @accounter/email-ingestion-gateway build

# Docker image (Playwright base, includes Chromium for body→PDF)
yarn workspace @accounter/email-ingestion-gateway docker:build

# Cloudflare Worker
yarn workspace @accounter/email-ingestion-gateway worker:deploy
```

The gateway image is based on `mcr.microsoft.com/playwright` because body→PDF rendering
(`src/html-to-pdf.ts`) launches headless Chromium. A runtime without a Chromium binary will fail
body→PDF rendering (caught and logged; the body document is simply omitted).

## Security model (summary)

- **Authenticity**: IP allowlist (defense-in-depth) + timestamp window (±300s) + HMAC-SHA256
  signature (primary) + single-use nonce replay protection. See `src/verifier.ts`.
- **Idempotency key**: the gateway-computed `rawMessageHash` (content-derived), never the
  sender-controlled `Message-ID` — preventing data-suppression and bulk-sender collisions.
- **Server-side business recognition**: sender evidence is sent on the **control** request; the
  recognized business is bound into the grant. The gateway can never attribute documents to an
  arbitrary business.
- **SSRF hardening** for internal-link fetching: host/path allowlist, private/loopback host +
  resolved-IP blocks, http(s)-only, redirects disabled, content-type allowlist, streamed size cap.
  See `src/link-fetcher.ts`.
- **Untrusted HTML**: email bodies render with JavaScript disabled in headless Chromium.

## Troubleshooting

When emails fail to insert, become quarantined, or get rejected, see
[`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) for a reason-code reference and a step-by-step
diagnosis guide.
