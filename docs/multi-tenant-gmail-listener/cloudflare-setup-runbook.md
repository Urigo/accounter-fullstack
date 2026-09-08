# Cloudflare Email Routing Setup Runbook

Operational runbook for routing inbound email through Cloudflare to the `email-ingestion-gateway`
service, managing secrets, and rolling back to the legacy Gmail listener if needed.

---

## 1. Cloudflare Routing Setup

### 1.1 Prerequisites

- A Cloudflare account with Email Routing enabled on your domain.
- The gateway deployed and reachable at a public HTTPS URL (e.g. `https://gateway.example.com`).
- A `CF_WEBHOOK_SECRET` value generated (see §3 Secret Management).

### 1.2 Email Routing → Worker setup

Cloudflare Email Routing forwards inbound messages to a Worker, which then calls the gateway HTTP
endpoint.

**Step 1 — Deploy the Worker** that forwards the event payload to the gateway.

**Do not copy the Worker source into this runbook.** The maintained implementation is
[`packages/email-ingestion-gateway/src/worker.ts`](../../packages/email-ingestion-gateway/src/worker.ts)
— deploy it with `yarn workspace @accounter/email-ingestion-gateway worker:deploy`. An inlined copy
lived here and drifted out of sync with the real handler, which is exactly the failure mode this
package keeps hitting; a pointer cannot drift.

What the handler does, in order:

1. Probes `GET /health` (bounded by a timeout) before touching the message stream, so an unreachable
   gateway leaves a clean fallback path.
2. Reads the raw MIME into memory.
3. Forwards the message to `EMAIL_FORWARD_DESTINATION` **unconditionally**, so a copy exists before
   the webhook is attempted. This is the whole no-loss guarantee, and it is only as good as the
   variable: the forward is wrapped in try/catch, so if the address is unset or unverified the
   failure is logged (`worker:forward_failed`) and swallowed, and **no archive copy is made**. Treat
   `EMAIL_FORWARD_DESTINATION` as required, and check `forwardDestinationConfigured` on the
   `worker:email:start` line to confirm it actually resolved.
4. HMAC-SHA256-signs `${timestamp}.${rawBody}` and `POST`s the raw MIME to `${GATEWAY_URL}/webhook`
   with the routing metadata in `x-cf-*` headers.
5. On a non-2xx it forwards to `FALLBACK_EMAIL` (skipped when that is unset or equal to
   `EMAIL_FORWARD_DESTINATION`) and **returns without throwing**. It throws only when no copy of the
   message was delivered at all — Cloudflare reads an unhandled exception as a temporary delivery
   failure and redelivers with growing backoff, so throwing on a permanent rejection loops forever.

Every branch emits one structured `worker:*` JSON line; read them with
`yarn workspace @accounter/email-ingestion-gateway wrangler tail --name email-ingestion-gateway-worker --format pretty`.

**Step 2 — Add Worker secrets** in the Cloudflare dashboard or with Wrangler:

Run these through the workspace so they use the Wrangler version pinned in
`packages/email-ingestion-gateway/package.json` rather than whatever a bare `wrangler` or `npx`
resolves to (this repo is yarn-only):

```bash
W="yarn workspace @accounter/email-ingestion-gateway wrangler"

$W secret put CF_WEBHOOK_SECRET         # paste the shared secret value
$W secret put GATEWAY_URL               # e.g. https://gateway.example.com
$W secret put EMAIL_FORWARD_DESTINATION # archive inbox; every message is forwarded here
$W secret put FALLBACK_EMAIL            # legacy Gmail inbox for rollback fallback
```

Use **secrets**, not plain-text variables. `wrangler.jsonc` declares no `vars`, so `wrangler deploy`
reconciles bindings against the config file and **deletes any dashboard Text variable** while
leaving secrets intact. Verify with `$W secret list --name email-ingestion-gateway-worker`: anything
visible in the dashboard but absent from that list is Text and will not survive the next deploy. A
silently-dropped `FALLBACK_EMAIL` is what turns a permanent gateway rejection into a Cloudflare
redelivery loop.

Keep `EMAIL_FORWARD_DESTINATION` and `FALLBACK_EMAIL` **distinct**. When they match, the Worker
skips the fallback forward — the runtime rejects a second forward to an address already used for the
message — and logs `worker:fallback_skipped` with `cause: FALLBACK_EQUALS_FORWARD_DESTINATION`.

### First repo-owned deploy (one-time)

The Worker predates wrangler: its source was pasted into the dashboard, so the repo has never owned
it. The first `wrangler deploy` is the one that can break things, because that is when wrangler
reconciles config against the dashboard. Work through this in order.

```bash
W="yarn workspace @accounter/email-ingestion-gateway wrangler"

$W whoami                                # prints the account id; export as CLOUDFLARE_ACCOUNT_ID
$W secret list --name email-forward-04a7 # which values are secrets (the rest are plain-text vars)
```

1. **Confirm the name matches.** `wrangler.jsonc` says `email-forward-04a7`. If Email Routing points
   somewhere else, fix the config — deploying under a non-matching name creates a _second_ Worker
   and leaves routing on the original, which looks like a deploy that did nothing.
2. **Account for every var the Worker reads**: `CF_WEBHOOK_SECRET`, `GATEWAY_URL`,
   `EMAIL_FORWARD_DESTINATION`, `FALLBACK_EMAIL` (optional), `HEALTH_PROBE_TIMEOUT_MS` (optional).
   Anything absent from `secret list` is a plain-text var, which `keep_vars: true` preserves — **do
   not set `keep_vars: false` while `GATEWAY_URL` is still a var**, or the deploy deletes it and
   every inbound email fails the health probe.
3. **Preferably convert the remaining vars to secrets**, so the values are not readable from the
   dashboard and `keep_vars` can eventually go away. Copy the current value out of the dashboard
   first — this replaces it, and a typo here takes ingestion down:
   ```bash
   $W secret put GATEWAY_URL                # paste the value the dashboard var currently holds
   $W secret list --name email-forward-04a7 # expect it to appear
   ```
4. **Dry-run before the real thing.** It bundles and validates without uploading:
   ```bash
   $W deploy --dry-run
   ```
5. **Deploy**, then confirm in the dashboard that the _existing_ Worker's "last deployed" moved and
   that no second Worker appeared, and that the Email Routing rule still targets it:
   ```bash
   $W deploy
   $W tail --name email-forward-04a7 --format pretty
   ```
   On the next inbound email the tail should open with `worker:email:start`, whose booleans report
   which bindings actually resolved — that line is the fastest confirmation the deploy kept its
   configuration.

No `send_email` binding is needed: `message.forward()` to a _verified destination address_ requires
none, which the current dashboard Worker demonstrates — it forwards today with zero bindings, and
`wrangler deploy --dry-run` reports "No bindings found".

After this, deploys are automatic — `.github/workflows/worker-deploy.yml` runs on pushes to `prod`
that touch the Worker or its config, and is also runnable via **workflow_dispatch** for rollbacks.
It needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets.

**Step 3 — Wire email addresses** in Cloudflare Email Routing:

1. Go to **Email → Email Routing → Routing Rules**.
2. Add a **Catch-all** or **Custom address** rule for each tenant alias.
3. Set the action to **Send to a Worker** and select the forwarder Worker.

> **Note**: Use non-guessable tenant aliases (e.g. `t-<uuid>@mail.example.com`) to reduce
> enumeration risk.

### 1.3 DNS records

Cloudflare Email Routing requires the following DNS records (auto-added when routing is enabled):

| Type | Name | Priority | Value                                        |
| ---- | ---- | -------- | -------------------------------------------- |
| MX   | @    | 10       | `route1.mx.cloudflare.net`                   |
| MX   | @    | 20       | `route2.mx.cloudflare.net`                   |
| TXT  | @    | —        | `v=spf1 include:_spf.mx.cloudflare.net ~all` |

---

## 2. Destination Gateway Configuration

The gateway is configured exclusively through environment variables.

| Variable                      | Required | Description                                                                 |
| ----------------------------- | -------- | --------------------------------------------------------------------------- |
| `PORT`                        | No       | HTTP listen port (default: `3000`)                                          |
| `EMAIL_INGESTION_V2_ENABLED`  | Yes      | Set `1` to enable v2 processing                                             |
| `EMAIL_INGESTION_SHADOW_MODE` | No       | Set `1` to run in shadow mode (respond immediately, orchestrate async)      |
| `CF_WEBHOOK_SECRET`           | Yes      | Shared HMAC-SHA256 secret — must match the Worker                           |
| `CF_IP_ALLOWLIST`             | No       | Comma-separated IPv4 addresses or CIDRs; empty = check disabled             |
| `GATEWAY_SERVER_URL`          | No       | Base URL of the accounter GraphQL server (default: `http://localhost:4000`) |
| `GATEWAY_CP_TOKEN`            | Yes      | Bearer token sent as `X-Gateway-CP-Token` for `gateway_control_plane` auth  |

### Recommended staging defaults

```dotenv
EMAIL_INGESTION_V2_ENABLED=0        # start disabled; flip after smoke tests pass
EMAIL_INGESTION_SHADOW_MODE=0
CF_WEBHOOK_SECRET=<generated-secret>
CF_IP_ALLOWLIST=                    # leave empty during initial deploy; add ranges after confirming source IPs
GATEWAY_SERVER_URL=https://api.staging.example.com
GATEWAY_CP_TOKEN=<generated-token>
```

### Recommended production defaults

```dotenv
EMAIL_INGESTION_V2_ENABLED=0        # start disabled; flip after shadow-mode validation
EMAIL_INGESTION_SHADOW_MODE=1       # shadow mode first
CF_WEBHOOK_SECRET=<production-secret>
CF_IP_ALLOWLIST=103.21.244.0/22,103.22.200.0/22,103.31.4.0/22,104.16.0.0/13,104.24.0.0/14,108.162.192.0/18,131.0.72.0/22,141.101.64.0/18,162.158.0.0/15,172.64.0.0/13,173.245.48.0/20,188.114.96.0/20,190.93.240.0/20,197.234.240.0/22,198.41.128.0/17
GATEWAY_SERVER_URL=https://api.example.com
GATEWAY_CP_TOKEN=<production-token>
```

> The IP ranges listed above are current Cloudflare Workers egress IPs. See §5 for the update
> process.

---

## 3. Secret Management and Rotation

### 3.1 CF_WEBHOOK_SECRET

This is the HMAC key shared between the Cloudflare Worker and the gateway. It authenticates that a
webhook request genuinely originated from your Worker.

**Generating a secret:**

```bash
openssl rand -hex 32
```

**Rotation (zero-downtime):**

1. Generate a new secret value.
2. Deploy the **gateway** with the new secret in `CF_WEBHOOK_SECRET`.  
   The gateway uses constant-time comparison so there is no timing window during the brief overlap.
3. Update the Worker's `CF_WEBHOOK_SECRET` secret via Wrangler:
   ```bash
   wrangler secret put CF_WEBHOOK_SECRET
   ```
4. Verify that new webhook calls succeed (check gateway logs for `webhook accepted` entries).
5. Discard the old value — it is no longer accepted.

> **Important**: The timestamp tolerance window is ±300 seconds. Requests signed with the old key
> that arrive during rotation will fail authenticity and return `401`. This is a small window; time
> the rotation during low-traffic periods.

### 3.2 GATEWAY_CP_TOKEN

This token authenticates the gateway to the accounter server as a `gateway_control_plane` role.

**Generating a token:**

```bash
openssl rand -hex 32
```

**Rotation:**

1. Generate a new token.
2. Update `GATEWAY_CP_TOKEN` in the **server** environment first.
3. Deploy the new server configuration.
4. Update `GATEWAY_CP_TOKEN` in the **gateway** environment.
5. Deploy the new gateway configuration.
6. Verify control calls succeed (check for `orchestrate:control:granted` log entries).

---

## 4. Optional mTLS Path

For environments requiring mutual TLS between the Cloudflare Worker and the gateway (beyond HMAC
signature verification):

### 4.1 Gateway TLS termination

Configure the gateway behind a TLS-terminating reverse proxy (nginx, Caddy, or a load balancer)
that:

1. Requires a client certificate from Cloudflare.
2. Passes the verified client CN or SAN in a header (e.g. `X-Client-Cert-CN`).

### 4.2 Cloudflare mTLS setup

1. In the Cloudflare dashboard, go to **SSL/TLS → Client Certificates**.
2. Generate a client certificate for the Worker.
3. Download the certificate and private key.
4. Store the private key as a Worker secret:
   ```bash
   wrangler secret put CF_MTLS_CERT
   wrangler secret put CF_MTLS_KEY
   ```
5. Update the Worker to attach the client certificate to outgoing requests using the Cloudflare
   `mTLS` API.

> **Note**: The HMAC signature check provides equivalent cryptographic authenticity guarantees. mTLS
> adds a transport-layer layer (certificate binding) on top. Both approaches are sound; mTLS is
> recommended when the gateway is exposed on a public IP without additional network controls.

---

## 5. IP Allowlist Update Process

Cloudflare periodically updates its Workers egress IP ranges. The gateway uses `CF_IP_ALLOWLIST` as
a defense-in-depth check (not as the primary trust signal).

**Current Cloudflare egress ranges**: https://www.cloudflare.com/ips/

**Update procedure:**

1. Fetch the current IPv4 ranges:
   ```bash
   curl -s https://www.cloudflare.com/ips-v4
   ```
2. Format as a comma-separated list.
3. Update `CF_IP_ALLOWLIST` in the gateway environment.
4. Deploy the updated configuration.
5. Monitor gateway logs for any `INVALID_AUTH` failures that would indicate an address mismatch.

> **If the allowlist is empty** (`CF_IP_ALLOWLIST=`), the IP check is disabled entirely and only
> HMAC signature verification and timestamp/nonce checks are enforced. This is acceptable when
> running behind Cloudflare Tunnel or other network-layer controls.

---

## 6. Staging Smoke Tests

Run these tests against a staging gateway (`EMAIL_INGESTION_V2_ENABLED=1`,
`EMAIL_INGESTION_SHADOW_MODE=0`) before enabling production traffic.

### Setup helpers (bash)

```bash
GATEWAY_URL=https://gateway.staging.example.com
SECRET=<your-staging-CF_WEBHOOK_SECRET>
ALIAS=test-alias@mail.example.com

sign() {
  local ts=$1 body=$2
  printf '%s.%s' "$ts" "$body" \
    | openssl dgst -sha256 -hmac "$SECRET" -hex \
    | awk '{print $2}'
}

# The body is the raw MIME message; routing metadata travels in headers.
MIME=$(printf 'From: sender@example.com\r\nTo: %s\r\nSubject: Test\r\nContent-Type: text/plain\r\n\r\nhello\r\n' "$ALIAS")

send() {
  local ts nonce sig
  ts=$(date +%s)
  nonce=$(uuidgen | tr '[:upper:]' '[:lower:]')
  sig=$(sign "$ts" "$MIME")
  curl -s -w '\nHTTP %{http_code}\n' \
    -X POST "$GATEWAY_URL/webhook" \
    -H "Content-Type: message/rfc822" \
    -H "x-cf-timestamp: $ts" \
    -H "x-cf-signature: $sig" \
    -H "x-cf-nonce: $nonce" \
    -H "x-cf-recipient: $ALIAS" \
    -H "x-cf-message-id: msg-$nonce" \
    --data-binary "$MIME"
}
```

### Test 1 — Valid request → 202

```bash
send
# Expected: HTTP 202, body contains {"status":"accepted", ...}
```

### Test 2 — Invalid signature → 401

```bash
ts=$(date +%s)
nonce=$(uuidgen | tr '[:upper:]' '[:lower:]')
curl -s -w '\nHTTP %{http_code}\n' \
  -X POST "$GATEWAY_URL/webhook" \
  -H "Content-Type: message/rfc822" \
  -H "x-cf-timestamp: $ts" \
  -H "x-cf-signature: 0000000000000000000000000000000000000000000000000000000000000000" \
  -H "x-cf-nonce: $nonce" \
  -H "x-cf-recipient: test@mail.example.com" \
  -H "x-cf-message-id: m1" \
  --data-binary "$MIME"
# Expected: HTTP 401, body contains {"error":"Unauthorized"}
```

### Test 3 — Replay attack → 401

```bash
send # first call: 202
send # use the SAME nonce — replay; Expected: HTTP 401 with reason REPLAY_DETECTED
# Note: modify the send helper to reuse a fixed nonce to reproduce this
```

### Test 4 — Unknown alias → 202 QUARANTINED

```bash
# Use an alias not registered in the server
ALIAS=unknown-$(uuidgen)@mail.example.com send
# Expected: HTTP 202, outcome field contains QUARANTINED or failed:true with UNKNOWN_ALIAS reason
```

### Test 5 — Feature flag disabled → 503

```bash
# Temporarily set EMAIL_INGESTION_V2_ENABLED=0 and redeploy, then:
send
# Expected: HTTP 503, body {"error":"Service unavailable", ...}
```

### Acceptance criteria

All 5 tests must produce the expected HTTP status before enabling `V2_ENABLED` in production. Log
the gateway correlation IDs for each test and verify they appear in the structured log stream.

---

## 7. Rollback to Legacy Listener

The legacy Gmail listener (`packages/gmail-listener`) remains active throughout the rollout. Rolling
back requires only a configuration change — no code deployment or data migration.

### Immediate rollback

1. Set `EMAIL_INGESTION_V2_ENABLED=0` in the gateway environment.
2. Deploy (or restart) the gateway.

The gateway returns `503 Service Unavailable` for all webhook calls. The legacy listener continues
processing Gmail push notifications independently; it was never disabled.

### Full shutdown of v2 path

If the gateway deployment itself needs to be torn down:

1. Remove the Cloudflare Worker Email Routing rule that forwards to the gateway.
2. All inbound email now lands only in Gmail and is processed by the legacy listener.

### Shadow-mode rollback

If running in shadow mode (`EMAIL_INGESTION_SHADOW_MODE=1`):

1. Set `EMAIL_INGESTION_SHADOW_MODE=0`.
2. The gateway continues responding `202` but no longer fires async orchestration calls.

### Data safety

- No v2 ingest writes occur when `V2_ENABLED=0`.
- In shadow mode, v2 writes are fire-and-forget and do not affect legacy writes.
- All idempotency keys and dedup fingerprints on the server use the message_id as the key, so a
  re-delivery after rollback and re-cutover is handled safely.

### Rollback criteria (trigger any one)

- Error rate on `orchestrate:control:denied` or `orchestrate:ingest:failed` logs exceeds 5% over a
  15-minute window.
- `TENANT_MISMATCH` or `GRANT_INVALID` reason codes appear in production ingest logs.
- Any confirmed cross-tenant data access.
- Latency on `/webhook` endpoint exceeds 2× the baseline p99 for 10+ minutes.
