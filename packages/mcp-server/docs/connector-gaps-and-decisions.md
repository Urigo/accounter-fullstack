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

## Recorded findings (not gaps)

Things learned while building a tool that are worth not re-deriving.

### Securities tables were never in the multi-business RLS scope (2026-08-23, fixed)

`2026-05-25T10-00-00.rls-multi-business-scope` switched every `tenant_isolation` read predicate to
`owner_id = ANY(accounter_schema.get_current_business_scope())`, leaving writes on
`get_current_business_id()`. Its table list covered 45 tables. All four securities tables —
`poalim_securities`, `poalim_securities_transactions`, `businesses_securities`,
`security_identifiers` — were created _after_ it (2026-08-11 / 08-13 / 08-20) and so still read
through the singular helper, verified against a live database before the fix.

The failure mode was a **silent narrowing, not a leak**: the connector forwards its resolved read
scope as `x-business-scope` and echoes that scope back to the caller, so a two-business caller was
told it had seen both while the securities tables had served one. The web client's business switcher
had the same bug. Fixed by `2026-08-23T10-00-00.rls-scope-securities-tables`, with predicates
byte-identical to the earlier migration's.

**The general lesson:** a table added after that migration does not inherit its predicate, and
nothing fails loudly when it doesn't. Any new owner-scoped table needs
`owner_id = ANY(get_current_business_scope())` written into its own creating migration. When adding
a tool over tables you did not create, check `pg_policies.qual` for them before trusting
`x-business-scope` to have narrowed anything.

### A Poalim security key is unique only within an owner (2026-08-24, fixed)

Found in review of the securities tools, and reachable _because_ the read scope was widened above.

`accounter_schema.security_identifiers` is unique on
`(owner_id, identifier_type, identifier_value)`, and `poalim_securities` dedupes per owner too. So
two of a tenant's businesses that both trade one security each carry it under the same Poalim key —
the ordinary case for a multi-business tenant, not an exotic one. While reads were pinned to a
single business a key-only lookup could not go wrong; once they follow a scope that spans owners,
both rows are visible at once and a `Map<key, business>` keeps whichever was written last, filing
one business's trades under the other's security.

Three lookups had it: the executions-to-business mapping (twice), the charge-to-security bridge, and
the reference-details loader. All now carry the owner — the execution queries resolve it in SQL by
joining `security_identifiers` on `(owner_id, identifier_value)` and returning `business_id` per
row, so the relation is expressed once rather than rebuilt from a map that cannot hold it; the two
DataLoaders take an owner-qualified key.

**The general lesson:** widening a read scope silently changes what "unique" means for every lookup
underneath it. A natural key that was unambiguous under single-business reads may only be unique
_per owner_ — check the unique index, not the intuition.

### Writes stay single-tenant even when reads do not

`USING` selects the rows a statement may act on, and Postgres consults it for DELETE and UPDATE as
well as SELECT; `WITH CHECK` constrains only the _new_ values an INSERT or UPDATE writes. A
permissive policy whose `USING` spans the read scope therefore authorizes deleting another in-scope
business's row — and updating one, since the `WITH CHECK` will happily accept the result once the
new value names the write target, which is to say the row gets _moved_ between businesses.

Every tenant-isolated table needs two RESTRICTIVE per-command policies alongside the permissive one:

```sql
CREATE POLICY tenant_isolation_delete ON … AS RESTRICTIVE FOR DELETE
  USING (owner_id = accounter_schema.get_current_business_id());
CREATE POLICY tenant_isolation_update ON … AS RESTRICTIVE FOR UPDATE
  USING (owner_id = accounter_schema.get_current_business_id());
```

They must be per-command: a restrictive `FOR ALL` would apply to SELECT and undo the multi-business
read scope entirely. INSERT needs none, having no `USING` at all.

> **Open item.** `2026-05-26T10-00-00.rls-delete-write-target` added the DELETE half for the 45
> tables it covered, but not the UPDATE half. Those tables still allow an in-scope cross-business
> UPDATE. Out of scope for the securities work, and worth its own change.

### Charge links and pagination do not compose (`accounter_get_security_executions`)

`matchExecutionsToTransactions` pairs a securities execution with the bank row behind it. There is
no link in the source — the scrape has no per-execution id — so the pairing is derived, exact, and
**greedy and one-to-one over the sets it is handed**, consuming executions oldest-first.

Hand it a page's slice and an execution on page 2 can claim the cash movement that belongs to one on
page 1, so the _same_ execution reports a _different_ charge at a different page size. A paginated
query therefore cannot resolve charge links from its own page.

`Query.securityExecutions` splits into two paths for this reason: without `includeCharges` the
filter pushes into SQL and the page is a `LIMIT`/`OFFSET` slice; with it, each named security's
whole history is fetched and paired, then filtered and sliced in memory — which is why that path
caps how many securities the filter may resolve to, and why the tool refuses `includeCharges` unless
the securities are named. Both paths order identically so they cannot disagree about what page 1 is.

**The general lesson:** before paginating a result whose fields are computed across rows, check
whether the computation is order- or set-dependent. A greedy one-to-one assignment is.

### These integration suites share one database and bypass RLS

`foreign-securities.integration.test.ts` and `security-businesses.integration.test.ts` run
concurrently against the same database, connect as a superuser (which bypasses
`FORCE ROW LEVEL SECURITY`), and the securities lookups carry no `owner_id` predicate because RLS is
what scopes them in production. So a lookup by ISIN sees every tenant's securities, and an assertion
on a whole result set's size assumes exclusive access to the database. Use synthetic per-suite ISINs
and assert on your own fixtures' buckets, not on totals.

## Open decisions

1. **Audience strategy.** Accept the shared `https://api.accounter.com` audience for MCP and GraphQL
   (gap 3), or pursue separation. Constrained by Auth0 ignoring `resource`.
2. **DCR interop.** Who owns reporting it, and is a fronting authorization server acceptable as a
   fallback if it is not fixed upstream? Gates any published connector.
3. **Production hosting.** Stable domain and TLS for the MCP origin; `MCP_PUBLIC_BASE_URL` must
   match it exactly.
4. **Third-party posture.** If a published connector is the goal, the tenant changes above become
   permanent production requirements, not debugging artifacts. Decide deliberately.
