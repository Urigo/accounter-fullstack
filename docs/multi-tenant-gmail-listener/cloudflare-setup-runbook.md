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

**Step 1 — Create a Worker** that forwards the event payload to the gateway:

> This snippet mirrors the maintained implementation in
> `packages/email-ingestion-gateway/src/worker.ts`; keep the two in sync.

```javascript
// workers/email-forwarder/index.js
const hex = bytes =>
  Array.from(new Uint8Array(bytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

async function isGatewayReachable(gatewayUrl) {
  try {
    const res = await fetch(`${gatewayUrl}/health`, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

export default {
  async email(message, env) {
    // 1. Probe the gateway first (keeps the stream untouched for a clean fallback if it fails)
    if (!(await isGatewayReachable(env.GATEWAY_URL))) {
      if (env.FALLBACK_EMAIL) {
        await message.forward(env.FALLBACK_EMAIL)
        return
      }
      throw new Error('Gateway unreachable and FALLBACK_EMAIL is not configured')
    }

    // 2. Read the raw message into memory
    const rawBuffer = await new Response(message.raw).arrayBuffer()
    const rawBytes = new Uint8Array(rawBuffer)

    // 3. Forward the email
    try {
      await message.forward(env.EMAIL_FORWARD_DESTINATION)
      console.log(`email forwarded to ${env.EMAIL_FORWARD_DESTINATION}`)
    } catch (e) {
      console.error(`Forwarding failed: ${e.message}`)
    }

    // 4. Continue with your webhook logic
    const timestamp = Math.floor(Date.now() / 1000)
    const nonce = crypto.randomUUID()

    // Compute HMAC-SHA256 over `${timestamp}.${rawBody}`, where rawBody is the
    // raw MIME message — the exact bytes sent as the request body. The gateway
    // verifies the signature over the body it receives, then parses the MIME,
    // extracts attachments, and computes the SHA-256 content hash itself. The
    // worker therefore only forwards the message plus routing metadata (in
    // headers); no hash is sent.
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.CF_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const prefix = new TextEncoder().encode(timestamp + '.')
    const payload = new Uint8Array(prefix.length + rawBytes.length)
    payload.set(prefix, 0)
    payload.set(rawBytes, prefix.length)
    const signature = hex(await crypto.subtle.sign('HMAC', key, payload))

    const res = await fetch(`${env.GATEWAY_URL}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'message/rfc822',
        'x-cf-timestamp': String(timestamp),
        'x-cf-signature': signature,
        'x-cf-nonce': nonce,
        // Routing metadata — the body itself is the raw MIME message.
        'x-cf-recipient': message.to,
        'x-cf-message-id': message.headers.get('message-id') ?? nonce,
        'x-cf-received-at': new Date().toISOString(),
        'x-correlation-id': nonce
      },
      // Send the raw MIME bytes as the request body.
      body: rawBytes
    })

    if (!res.ok) {
      // Gateway is reachable but rejected the request — e.g. it is disabled
      // (EMAIL_INGESTION_V2_ENABLED=0 returns 503 during rollback) or an auth
      // check failed. Forward to the legacy Gmail inbox so no email is lost
      // during rollback, and only throw when no fallback exists. This forwards
      // *after* the read on a best-effort basis — verify it forwards in the
      // Cloudflare runtime via the §6 staging smoke tests.
      if (env.FALLBACK_EMAIL) {
        await message.forward(env.FALLBACK_EMAIL)
        return
      }
      throw new Error('Gateway returned status ' + res.status)
    }
  }
}
```

**Step 2 — Add Worker secrets** in the Cloudflare dashboard or with Wrangler:

```bash
wrangler secret put CF_WEBHOOK_SECRET # paste the shared secret value
wrangler secret put GATEWAY_URL       # e.g. https://gateway.example.com
wrangler secret put FALLBACK_EMAIL    # legacy Gmail inbox for rollback fallback
```

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
