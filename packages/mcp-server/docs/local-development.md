# MCP Server — Local Development & Claude Connector Setup

How to run `@accounter/mcp-server` locally and connect it to Claude Desktop as a custom connector.

For the server's own configuration reference see [`packages/mcp-server/README.md`](../README.md);
for incident handling see [`operations-runbook.md`](./operations-runbook.md).

## Why this is not just "run it on localhost"

Claude Desktop's custom connectors require an **HTTPS** URL — a plain `http://localhost:3100/mcp`
connector is rejected outright. The MCP server also requires a valid Auth0 bearer token on every
`POST /mcp`, and Claude obtains that token through a full OAuth flow it drives itself. So a local
setup needs three things beyond the server process:

1. an HTTPS origin in front of port 3100 (a tunnel),
2. an Auth0 application Claude can use to run the OAuth flow,
3. `MCP_PUBLIC_BASE_URL` matching the tunnel origin exactly.

> A stdio→HTTP bridge (e.g. `supergateway`) does **not** work. Those bridges have no OAuth client;
> they receive the server's `401` challenge, give up, and exit — surfacing in Claude as the generic
> "Server disconnected".

## 1. Start the upstream and the server

```bash
# Accounter GraphQL server must be reachable (default GRAPHQL_UPSTREAM_URL)
yarn workspace @accounter/server dev # http://localhost:4000/graphql

yarn workspace @accounter/mcp-server dev # http://localhost:3100
curl http://localhost:3100/health        # → {"status":"ok",...}
```

## 2. Start the HTTPS tunnel

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3100
```

It prints a hostname such as `https://clip-austin-cohen-threaded.trycloudflare.com`. Keep this
process running — the connector is unreachable without it.

> **Quick tunnels get a new hostname on every restart.** Each rotation silently invalidates both
> `MCP_PUBLIC_BASE_URL` and the connector URL in Claude. If you restart `cloudflared`, redo steps 3
> and 5. For repeated work, a named tunnel (`cloudflared tunnel create`) gives a stable hostname.

Recovering the current hostname without the tunnel's own output:

```bash
PORT=$(lsof -nP -a -p "$(pgrep -f 'cloudflared tunnel')" -iTCP -sTCP:LISTEN \
  | awk 'NR>1{split($9,a,":"); print a[length(a)]}')
curl -s "http://127.0.0.1:$PORT/metrics" | grep -oE "[a-z0-9-]+\.trycloudflare\.com" | sort -u
```

## 3. Point the server at the tunnel origin

In `packages/mcp-server/.env`:

```bash
MCP_PUBLIC_BASE_URL=https://clip-austin-cohen-threaded.trycloudflare.com
```

**`MCP_PUBLIC_BASE_URL` is an origin — scheme and host, no path.** The server appends
`/.well-known/oauth-protected-resource` to it (`src/oauth/metadata.ts`) and publishes it verbatim as
the OAuth `resource` identifier (`src/server.ts`). Appending `/mcp` makes the discovery pointer
`404` and makes `resource` disagree with the origin Claude validates.

The connector URL in step 5 _does_ include `/mcp`. Keep the asymmetry straight — it is the single
easiest thing to get wrong here.

Restart the server; `.env` is only read at startup.

## 4. Create the Auth0 application

Claude can register its own client via Dynamic Client Registration, but **Auth0's DCR response is
currently rejected by Claude** (see
[`connector-gaps-and-decisions.md`](./connector-gaps-and-decisions.md) gap 1). Pre-register a
first-party application instead:

1. Auth0 → **Applications → Create Application** → **Regular Web Applications**
2. **Settings → Allowed Callback URLs**: `https://claude.ai/api/mcp/auth_callback` (per
   [`spec.md`](./spec.md) §6.3)
3. **Advanced Settings → Grant Types**: enable **Authorization Code** and **Refresh Token** (the
   Accounter API's `token_lifetime` is 900s; without refresh, Claude drops every 15 minutes)
4. Copy the **Client ID** and **Client Secret**

The application must be authorized for the `https://api.accounter.com` API under **APIs → Accounter
API → Application access → User-delegated access**.

> Do not reuse the API's auto-created _"Accounter API (Test Application)"_ — it is coupled to the
> API object and is an M2M client, not a web application.

## 5. Add the connector in Claude Desktop

**Settings → Connectors → Add custom connector**

| Field                 | Value                                         |
| --------------------- | --------------------------------------------- |
| Name                  | `Accounter`                                   |
| Remote MCP server URL | `https://<tunnel-host>/mcp` — **with** `/mcp` |
| OAuth Client ID       | from step 4                                   |
| OAuth Client Secret   | from step 4                                   |

Connect, and complete the Auth0 login in the browser.

## 6. Verify

```bash
BASE=https://clip-austin-cohen-threaded.trycloudflare.com

curl -s -o /dev/null -w '%{http_code}\n' "$BASE/health" # 200
curl -s "$BASE/.well-known/oauth-protected-resource"    # resource == $BASE
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/mcp" \
  -H 'Content-Type: application/json' -d '{}' # 401

curl -s http://localhost:3100/metrics # after a tool call
```

`resource` must equal the origin exactly — not `.../mcp`. A healthy connector shows entries under
`requestsTotal` (e.g. `accounter_search_charges|success`) and nothing new in `authFailuresTotal`.

### End-to-end business scoping

Worth checking once from a real client, because a broken scope still returns plausible-looking data
— it is just the wrong (wider) set. Ask Claude to run the three steps below and inspect the replies.

1. **Discover** — "list the businesses I have access to". Should return one row per business with
   `memberBusinessId`, `name`, and your role.
2. **Scope a call** — "list tags for `<memberBusinessId>`". In the structured reply,
   `scope.memberBusinessIds` must equal exactly the id you asked for, and every row's `ownerId` must
   match it. If `scope` contains more ids than you asked for, narrowing is not reaching the server.
3. **Negative check** — ask for a business id you do not belong to (any random UUID). It must come
   back as an error with code `AUTHORIZATION_ERROR`. A successful reply, or an empty-but-successful
   one, means ids are being silently dropped instead of rejected — the failure mode scope validation
   exists to prevent.

To confirm the header itself is doing the work rather than the MCP-side filter, tail the GraphQL
server and check `app.current_business_scope` is set per request. Note that
`parseBusinessScopeHeader` requires strict UUIDs upstream, so a dev database seeded with non-UUID
business ids will fail every scoped tool call with an `UPSTREAM_ERROR`.

## 7. Shutting down

Stop `cloudflared` when you are not actively testing — the quick tunnel publishes your local server
on the public internet. It is auth-gated, but it proxies to your local GraphQL with real data.
Restore `MCP_PUBLIC_BASE_URL=http://localhost:3100` for normal local work.

## Troubleshooting

Symptoms observed in practice, with the diagnosis for each:

| Symptom in Claude                                     | Cause                                                                               | Fix                                               |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| "Server disconnected" via a stdio bridge              | bridge has no OAuth client; got `401` and exited                                    | use a native custom connector, not `supergateway` |
| Connector URL rejected on entry                       | `http://localhost` is not HTTPS                                                     | tunnel (step 2)                                   |
| Auth0 branded "Oops!, something went wrong"           | `/authorize` rejected by Auth0                                                      | read the tenant log — see below                   |
| "Couldn't register with … sign-in service"            | Auth0 DCR response rejected by Claude                                               | pre-registered client (step 4)                    |
| "no MCP server was found at the provided URL"         | connector URL path wrong — only exact `/mcp` works (`/` and `/mcp/` both `404`)     | fix the connector URL                             |
| "Authorization with … failed"                         | `resource` mismatch — usually `/mcp` in `MCP_PUBLIC_BASE_URL`                       | step 3                                            |
| "authorized, but … returned an error when connecting" | tunnel hostname does not resolve — `cloudflared` is running but never registered it | restart the tunnel (see below)                    |

### Dead tunnel that still looks alive

`cloudflared` can keep running, and keep reporting a hostname, while having failed to register it
with Cloudflare's edge — the hostname then returns `NXDOMAIN` and the server is simply unreachable.
The server itself looks perfectly healthy on localhost, which makes this easy to misdiagnose as a
config problem.

Check DNS first — it separates "tunnel dead" from "config wrong" in one second:

```bash
HOST=$(grep MCP_PUBLIC_BASE_URL packages/mcp-server/.env | cut -d= -f2 | sed 's|https://||')
dig +short "$HOST" # empty ⇒ tunnel is dead
curl -s --max-time 5 "http://127.0.0.1:20241/metrics" \
  | grep -E "tunnel_register_fail|register_connection" # non-zero ⇒ registration failing
```

Recovery is a full restart of the tunnel, followed by steps 3 and 5 with the new hostname:

```bash
pkill -f 'cloudflared tunnel'
cloudflared tunnel --url http://localhost:3100
```

Given how often quick tunnels rotate or fail, a named `cloudflared` tunnel (Cloudflare account +
domain) or an ngrok static domain is worth the one-time setup — it removes the `.env`/connector
re-editing entirely.

The MCP server's own logs show nothing for most of these, because the request either never arrives
or is rejected before the auth layer. Two sources are far more useful:

**`GET /metrics`** distinguishes "never arrived" from "arrived and was rejected":

- `authFailuresTotal.missing_token` — reached `/mcp` without a token
- `authFailuresTotal.invalid_token` — token present but failed verification
- empty `requestsTotal` with no `invalid_token` — Claude never reached `/mcp` at all (wrong
  URL/path, or dead tunnel)

**Auth0 tenant logs** carry the real OAuth errors that the branded error page hides — Dashboard →
**Monitoring → Logs**, or via the Management API with `read:logs`. Look for type `f` (failed)
entries; `details.qs` shows the exact `/authorize` parameters Claude sent, including `resource` and
`redirect_uri`.
