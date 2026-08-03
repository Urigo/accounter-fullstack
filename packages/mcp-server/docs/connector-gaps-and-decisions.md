# MCP Connector — Known Gaps & Open Decisions

Findings from the first end-to-end Claude Desktop ↔ `@accounter/mcp-server` connection
(2026-07-30/31). The connector works locally; this records what stands between that and a
production/published connector, and what still needs a decision.

Complements [`submission-checklist.md`](./submission-checklist.md) — none of the gaps below appear
there, and its "Authentication & OAuth discovery" section is marked fully complete while gap 1 is
outstanding.

Setup instructions live in [`local-development.md`](./local-development.md). The completed
owner-scoping effort is reviewed in [`owner-scoping-review.md`](./owner-scoping-review.md), which
also records findings not tracked as gaps here.

**For the actionable list, see [`todo.md`](./todo.md)** — it consolidates the open items from this
document and the review into one place. This document keeps the analysis behind each item.

## Known gaps

**Still open: 1, 3, 4, 6, 7. Closed: 2, 5, 8** — kept below in condensed form, with the resolution,
so they are not re-discovered as bugs. Gap numbers are stable; other docs reference them.

### 1. Auth0 DCR is rejected by Claude — **critical, blocks production**

`POST /oidc/register` returns `201 Created`, but Claude reports "Couldn't register with Accounter's
sign-in service" and never proceeds to `/authorize`.

The logged response body contains only `client_id`, `client_secret`, `client_name`, `redirect_uris`,
`token_endpoint_auth_method` — no `grant_types` or `response_types`. RFC 7591 expects registered
metadata echoed back; that is the likely rejection cause, though Claude's side is not observable.

Registration originates from Anthropic's backend (`160.79.106.x`, `python-httpx`), not the desktop
app, so nothing can be patched locally.

**Impact.** A published connector _must_ use DCR — arbitrary users cannot be handed a confidential
client secret. The pre-registered-client workaround is viable only for developers and small trusted
groups. **This is the critical path to production, and it is not ours to fix.** Options: report the
interop bug to Anthropic and/or Auth0, or front Auth0 with an authorization server that implements
RFC 7591 the way Claude expects.

Reproduction data is in the Auth0 tenant logs (type `sapi`, "Dynamic client registration").

### 3. No resource binding: MCP and GraphQL share one audience — **medium**

Auth0 ignores the RFC 8707 `resource` parameter Claude sends (observed: `resource=<tunnel URL>`
discarded) and substitutes the tenant Default Audience, `https://api.accounter.com`.

**Impact.** The MCP server and the GraphQL API validate the same audience, so a token minted for the
web SPA is accepted by the MCP server and vice versa. The mechanism that normally prevents token
reuse across resources is not in effect. Giving the MCP server a distinct audience is not currently
possible: Claude only sends `resource`, and Auth0 will keep substituting the tenant default. Note
also that Default Audience is tenant-wide and affects every application in the tenant.

This is a design decision to make consciously, not a bug to fix.

### 4. Ephemeral tunnel hostname — **medium (dev friction)**

`cloudflared` quick tunnels get a new hostname on every restart, silently invalidating both
`MCP_PUBLIC_BASE_URL` and the connector URL. Rotated twice in a single session. Production needs a
stable domain with real TLS; ongoing development wants a named tunnel.

### 6. `submission-checklist.md` omits client registration — **low-medium**

The checklist covers the server's OAuth discovery obligations but never mentions DCR or how clients
obtain credentials, so it reads as complete while gap 1 is open. Add a client-registration line item
and list gap 1 under "Known gaps to disclose at submission".

### 7. Connector uses the API's auto-created test application — **low-medium (deferred)**

The connector authenticates as `jTQFYG0Jgzoj5HlQzB2YNiRbfiB8dYJh`, which is the Accounter API's
auto-created _"Accounter API (Test Application)"_ renamed to `Claude MCP Connector`. Accepted
deliberately (2026-07-31) to avoid extra setup while the local connector was being brought up.

Latent problems, none of which affect current operation:

- **Lifecycle is tied to the API object.** Auth0 removes the test application when its API is
  deleted, so recreating or replacing the Accounter API silently destroys the connector's
  credentials with nothing pointing at the dependency.
- **Shared with the dashboard.** It backs the API's **Test** tab; anyone rotating its secret there
  breaks the connector.
- **Wrong application type.** It is a non-interactive M2M client running an Authorization Code +
  Refresh Token flow. Functional (grant types were enabled manually), but Auth0 defaults and
  anything keying off `app_type` assume M2M, and the name now misrepresents what the object is.

**Task:** replace it with a purpose-built **Regular Web Application** (callback
`https://claude.ai/api/mcp/auth_callback`, Authorization Code + Refresh Token grants), move the
user-delegated grant on the Accounter API to the new app, update the connector's client ID/secret in
Claude Desktop, and restore the test application's original name. Best paired with any other change
that already requires re-granting API access.

## Open decisions

1. **Audience strategy.** Accept the shared `https://api.accounter.com` audience for MCP and GraphQL
   (gap 3), or pursue separation. Constrained by Auth0 ignoring `resource`.
2. **DCR interop.** Who owns reporting it, and is a fronting authorization server acceptable as a
   fallback if it is not fixed upstream? Gates any published connector.
3. **Production hosting.** Stable domain and TLS for the MCP origin; `MCP_PUBLIC_BASE_URL` must
   match it exactly.
4. **Third-party posture.** If a published connector is the goal, the tenant changes above become
   permanent production requirements, not debugging artifacts. Decide deliberately.
