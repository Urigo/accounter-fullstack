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

### 2. `MCP_TOOL_ALLOWLIST` is not enforced — **high before phase 2**

Parsed into `env.server.toolAllowlist` (`packages/mcp-server/src/config/env.ts`) and documented as
the least-privilege control ("empty allowlist means no tools are exposed"), but no code reads it.
All registered tools are exposed regardless.

**Impact.** Low today — phase 1 is read-only. It becomes a real control gap the moment phase 2 adds
mutating tools. Either wire it into the registry or correct the documentation; today the docs
describe a control that does not exist.

> **When enforcement lands, `accounter_list_businesses` must be in the default allowlist.** It is
> the discovery entry point for business scoping: the model calls it to learn which `businessId`
> values exist before passing them to the other tools. Omitting it does not degrade scoping
> gracefully — it removes the only way to discover a business id, so every business-scoped call is
> left guessing. Note the failure would be silent: the remaining tools still work, just unscoped and
> defaulted to all memberships.

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

### 5. `POST /mcp/` returns 404 — **low**

Only the exact path `/mcp` is routed; `/` and `/mcp/` both `404`. A trailing slash looks correct and
fails silently, and 404s never reach the auth layer, so `/metrics` records nothing — this cost real
debugging time. Tolerating a trailing slash is a small change.

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

### 8. MCP GraphQL documents are not validated by CI — ✅ **CLOSED (2026-08-02)**

The connector's upstream queries are template literals in `src/tools/*.ts` and
`src/upstream/memberships.ts`. Nothing checked them against the schema: `yarn graphql:validate`
scans `packages/client` only, `graphql-codegen` did not read this package, and TypeScript sees the
queries as opaque strings.

**Impact.** A misspelled field, a field removed upstream, or a selection on the wrong type compiles,
lints, and passes every unit test — the tool suites stub `fetch`, so they never contact a real
schema. The failure surfaces only at runtime against the live server, as a sanitized
`UPSTREAM_ERROR` that does not name the offending field. This is a live risk whenever the schema
changes underneath the connector: nothing in this repo links the two.

**Resolved by graphql-codegen.** #4078 added `./packages/mcp-server/src/tools/*.ts` to the
`documents` list in `codegen.ts`, and this change adds `./packages/mcp-server/src/upstream/*.ts`
alongside it — the membership bootstrap issues its own query outside `src/tools`, so without the
second entry it would remain the one MCP document nothing validates.

Codegen validates every listed document against the schema and **exits non-zero** on a bad field
(verified in both directories by temporarily misspelling one). Because `yarn generate:graphql` runs
in the shared `./.github/actions/setup` action, this fails every CI job that builds the repo, not
just a dedicated check.

A standalone validator script was written for this first and then removed: with the codegen
documents list extended, it duplicated the same check with a second mechanism to keep in sync, and
covered strictly less (it validated documents but produced no types).

## Owner-scoping pre-flight (Phase 0) — RLS reaches `extended_tags`

Pre-flight check from
[`../../../docs/coherent-owner-scoping-for-mcp/plan.md`](../../../docs/coherent-owner-scoping-for-mcp/plan.md)
Phase 0, run on 2026-08-01 against the **production** database (`accounter_prod_db` on Azure — the
target the repo root `.env` points at), read-only catalog queries only.

**Result: PASS.** Forwarding `x-business-scope` _will_ narrow `allTags` through the `extended_tags`
view. No `security_invoker` change and no resolver-side `WHERE owner_id = ANY(...)` fallback are
needed, and Phase 2 for tags is not invalidated.

Verified chain — every link must hold, and all four do:

| Check                            | Result                                                          |
| -------------------------------- | --------------------------------------------------------------- |
| `extended_tags` view owner       | `prod_group`                                                    |
| `prod_group` privileges          | `rolsuper = f`, `rolbypassrls = f` — cannot bypass RLS          |
| `tags` table RLS                 | `relrowsecurity = t` **and `relforcerowsecurity = t`**          |
| `tags` policy `tenant_isolation` | `owner_id = ANY(accounter_schema.get_current_business_scope())` |
| `get_current_business_scope()`   | reads `current_setting('app.current_business_scope')`           |

Two points worth keeping, because the plan's stated check alone is not sufficient:

- **`FORCE ROW LEVEL SECURITY` is the load-bearing setting here.** `prod_group` owns `tags`, and a
  table owner bypasses its own RLS policies _unless_ RLS is forced. The plan checks only
  `rolsuper`/`rolbypassrls`; had `relforcerowsecurity` been `f`, the view would have escaped RLS
  with both of those still `f`. `charges` and `tax_categories` are likewise `t`/`t`.
- **Scope comes from a session GUC, not `current_user`.** Because the policy resolves through
  `current_setting('app.current_business_scope')`, it evaluates identically regardless of which role
  executes the view — which is precisely why the missing `security_invoker` is harmless here.
  `extended_tags` has empty `reloptions` (no `security_invoker`), and it does not matter.

Note that `extended_charges` is owned by a _different_ role (`accounter_prod_user`) than
`extended_tags` (`prod_group`), so the plan's reasoning that "`extended_charges` works, therefore
this most likely already works" does not transfer directly — the two were checked independently.

On the current behavior the plan describes as a leak: with no `x-business-scope` header the server
sets the scope to the caller's full membership list, so `allTags` returns a **union across the
caller's own businesses** — untagged and indistinguishable, but not a cross-tenant leak.
`get_current_business_scope()` falls back to a single business id only when the GUC is unset
entirely.

> Verified on **production**. Ownership and role attributes are environment-specific, so re-run
> these queries against the local dev database before assuming dev behaves the same — dev is the
> unverified environment here, not prod.

## Auth0 tenant changes made during debugging

Applied to the dev tenant `dev-cnaunfqjwhwwd8ld` to get DCR-based connection working. Both exist
only because Auth0 marks DCR clients as third-party (`tpc_…` ids); neither is exposed in the normal
Auth0 dashboard views.

| Change                                                                         | Object                                   | Purpose                                                  |
| ------------------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------- |
| `subject_type_authorization.user.policy`: `require_client_grant` → `allow_all` | Accounter API `699c2d8a2f8cfd0eb0e4f68f` | third-party clients cannot hold pre-registered grants    |
| `is_domain_connection`: `false` → `true`                                       | `google-oauth2` `con_lbR5Lim19YOK1qIu`   | third-party clients only accept domain-level connections |

Neither is required once the setup uses a pre-registered first-party client, and **both were
reverted on 2026-07-31**, verified by a full reconnect:

- `is_domain_connection` — back to `false`.
- `user.policy` — back to `require_client_grant`.

The connector is now authorized by an explicit _user-subject_ grant on the Accounter API (**APIs →
Accounter API → Application access → User-delegated access**) rather than by a permissive policy.
That grant must move with the application if the app is ever replaced — see gap 7.

**Ordering matters.** A first attempt at the `user.policy` revert was rolled back because the grant
did not yet exist: it broke the connector instantly, including refresh-token exchanges on the live
session (`fertft` in the tenant logs), not just new logins. Create the grant first, then flip the
policy, then verify with a full reconnect — under `allow_all` a successful reconnect proves nothing
about the grant.

**Do not replay either on a production tenant without a deliberate decision** — domain-level
promotion lets any third-party app registering against the tenant use that connection for login, and
`allow_all` lets any client request user-delegated tokens for the Accounter API.

Temporarily widened Management API scopes on the `accounter` M2M application (`read:connections`,
`update:connections`, `read:resource_servers`, `update:resource_servers`, `read:logs`) should be
returned to the original four `*:users` scopes. These credentials are the root `.env`
`AUTH0_CLIENT_ID`/`SECRET` used by the running server, so the widening applies to the application
process itself. `read:logs` is read-only and worth keeping — it was the single most useful
diagnostic in this work.

## Decided: stateless connector, self-describing responses

**Decision (2026-08-01): the connector stays stateless; business scope is carried per call, never
held as session state.**

There is no `Mcp-Session-Id`, no session store, and auth is re-derived per request — so there is
nowhere to hang an "active business" even if we wanted one. The alternative considered was a
stateful `set_active_business`-style tool with server-side stickiness.

**Why stateless.** A sticky active business is invisible to the model between calls: it cannot see
what scope a result was produced under, so a silently-widened or stale scope looks identical to a
correct one. It would also need a session store, an expiry policy, and a cross-request invalidation
story when memberships change mid-session — all to avoid passing an id the model already has.

**What replaces stickiness.** The feedback loop that session state would have provided is delivered
on _every_ call instead: a discovery tool enumerates businesses, every business-scoped tool takes a
uniform optional `businessIds`, the resolved scope is forwarded as `x-business-scope` (RLS enforces
it), and each response echoes `scope.businessIds` with every row owner-tagged.

**Cost accepted.** The model must pass ids explicitly on each call, and omitting them means "all my
businesses" — a wider default than a sticky single business would give. That widening is made
visible rather than silent, which is the trade: the response says which businesses it covered.

## Open decisions

1. **Audience strategy.** Accept the shared `https://api.accounter.com` audience for MCP and GraphQL
   (gap 3), or pursue separation. Constrained by Auth0 ignoring `resource`.
2. **DCR interop.** Who owns reporting it, and is a fronting authorization server acceptable as a
   fallback if it is not fixed upstream? Gates any published connector.
3. **`MCP_TOOL_ALLOWLIST`.** Implement enforcement, or remove the claim from the docs (gap 2).
   Should be settled before phase 2 write tools land.
4. **Production hosting.** Stable domain and TLS for the MCP origin; `MCP_PUBLIC_BASE_URL` must
   match it exactly.
5. **Third-party posture.** If a published connector is the goal, the tenant changes above become
   permanent production requirements, not debugging artifacts. Decide deliberately.
