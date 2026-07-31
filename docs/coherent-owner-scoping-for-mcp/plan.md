# Coherent owner/business scoping for `packages/mcp-server`

## Context

`packages/mcp-server` handles multi-business ownership three different, mutually inconsistent ways:

| Tool                            | Owner handling today                                        | Problem                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accounter_search_charges`      | takes `businessIds?`, maps them onto `filters.byBusinesses` | **Wrong filter.** `byBusinesses` is the _counterparty_ predicate (`ec.business_array && $ids`), and `charges.provider.ts:531` builds that array as `array_remove(base.business_array, fc.owner_id)` — the owner is explicitly removed. The owner predicate is `byOwners` (`c.owner_id IN $ownerIds`). The tool returns a tiny wrong slice (only inter-company charges). |
| `accounter_list_tags`           | no business param at all                                    | Upstream `allTags` takes no arguments; returns the union across every business the caller belongs to, and `type Tag` has **no owner field**, so rows are indistinguishable.                                                                                                                                                                                             |
| `accounter_list_tax_categories` | no business param at all                                    | Same union problem. `TaxCategory.ownerId` exists in the schema but the MCP query doesn't select it.                                                                                                                                                                                                                                                                     |
| `accounter_balance_report`      | required `businessId`                                       | Handler ignores it and uses `context.readScope.businessIds[0]`. Latent, not live (policy narrows to exactly that one today), but breaks the moment a `businessIds` param is added.                                                                                                                                                                                      |

The root cause: **the MCP never sends `x-business-scope` upstream.** The server has full support for
it (`packages/server/src/plugins/business-scope-header.ts` → `auth-plugin.ts:52` →
`auth-context.provider.ts` `applyRequestedReadScope` → `tenant-db-client.ts`
`app.current_business_scope` → RLS across ~45 tables) and the web client uses it in production. The
MCP relies instead on best-effort filter arguments, which the argument-less queries can't express at
all.

**Chosen model — stateless and self-describing.** The connector is deliberately stateless (no
`Mcp-Session-Id`, no session store, auth re-derived per request), so there is nothing to hang an
"active business" on. Instead: a discovery tool lets the model enumerate businesses, every
business-scoped tool takes a uniform optional `businessIds[]`, the resolved scope is forwarded as
`x-business-scope` so **RLS is the enforcement point**, and every response echoes its effective
scope with every row owner-tagged — giving the model the feedback loop that stickiness would
otherwise provide, on every single call.

```
1. accounter_list_businesses → [{businessId, name, role}]
2. accounter_search_charges { businessIds: ["b1"] }
   → x-business-scope: b1        (RLS narrows upstream)
   → { charges: [{id, ownerId, ownerName, …}],
       scope: { businessIds: ["b1"] } }
```

Omitting `businessIds` still means "all my businesses" — but rows stay owner-tagged, so a silent
widening is visible rather than silent.

---

## Phase 0 — pre-flight check (do this first, it can invalidate Phase 2 for tags)

`extended_tags` is a **view**, and no view in this repo sets `security_invoker`, so views run with
the view owner's privileges. If that owner is a superuser or has `BYPASSRLS`, `x-business-scope`
will not narrow `allTags` at all (and `allTags` is leaking cross-tenant today):

```sql
SELECT viewowner FROM pg_views WHERE schemaname='accounter_schema' AND viewname='extended_tags';
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = '<that owner>';
```

`extended_charges` is also a view on the primary RLS-scoped read path, so this most likely already
works. If it does not: `ALTER VIEW accounter_schema.extended_tags SET (security_invoker = true)` (PG
15+), or add an explicit `WHERE owner_id = ANY($ownerIds)` to `TagsProvider.getAllTags` fed by
`ScopeProvider.getReadScope()` — the canonical resolver-side pattern
(`packages/server/src/modules/auth/providers/scope.provider.ts`). `taxCategories` queries base
tables directly and is unaffected either way.

---

## Phase 1 — server: expose `Tag.ownerId`

`extended_tags` is declared `(id, parent, name, names_path, ids_path)` in
`packages/migrations/src/actions/2024-06-29T17-52-10.refactor-tags.ts:703` — no `owner_id`, so
`IGetAllTagsResult` has none either.

1. **New migration** `packages/migrations/src/actions/<timestamp>.extended-tags-owner-id.ts`,
   modeled on the refactor-tags migration. `CREATE OR REPLACE VIEW` may append but not reorder
   columns, so `owner_id` goes **last**: column list becomes
   `(id, parent, name, names_path, ids_path, owner_id)`, with `t.owner_id` added to both the anchor
   and recursive branches of the CTE and to the `get_ancestor(...)` column list.
2. **Register it** in `packages/migrations/src/run-pg-migrations.ts` (explicit import + array entry
   — migrations are not auto-discovered).
3. **Schema**: `packages/server/src/modules/tags/typeDefs/tags.graphql.ts`, add `ownerId: UUID!` to
   `type Tag`. Non-null is correct — `accounter_schema.tags.owner_id` is `NOT NULL`. pgtyped will
   still infer the view column as `string | null` (as it already does for `id`), so the resolver
   uses the same `!` the file already uses.
4. **Resolver**: `packages/server/src/modules/tags/resolvers/tags.resolvers.ts`, in the `Tag:` block
   — `ownerId: tag => tag.owner_id!`.
5. **Codegen, in this order**: apply the migration to a live local DB → `yarn generate:sql` (pgtyped
   introspects the live DB; regenerates `IGetAllTagsResult`) → `yarn generate:graphql`. Generating
   before migrating yields a type without `owner_id` and a resolver that fails to typecheck.

The `Tag` mapper is shared (`codegen.ts:153` → `IGetAllTagsResult`), so `Tag.parent`,
`Tag.fullPath`, and `Charge.tags` all pick the field up. Adding a field is non-breaking for existing
client selections and for `graphql-inspector validate`.

---

## Phase 2 — MCP: forward `x-business-scope` centrally

Goal: make it _impossible_ for a tool handler to forget the header. Today each handler hand-builds
`{ correlationId, authorization }`; replace that with a context prebuilt in `execute.ts`, where
`readScope` is known.

**`src/upstream/graphql-client.ts`**

- Export `BUSINESS_SCOPE_HEADER = 'x-business-scope'` (mirroring
  `packages/server/src/plugins/business-scope-header.ts`).
- Add `businessScope?: readonly string[]` to `UpstreamRequestContext`.
- In `executeOnce`, after the `Authorization` block, set the header comma-joined **only when
  non-empty** — an empty header parses upstream as `absent` ⇒ "all memberships", the exact opposite
  of "none". This guard is load-bearing. Filter falsy ids so a trailing comma (a hard `FORBIDDEN`
  upstream) can never be emitted.

**`src/tools/registry.ts`** — add `upstream: UpstreamRequestContext` to `ToolExecutionContext`
(additive; keep `correlationId`/`authorization`, which tests and logging use).

**`src/tools/execute.ts`** — in `runTool` step 4, build it from the already-resolved decision:

```ts
upstream: { correlationId, authorization, businessScope: decision.readScope.businessIds }
```

**`src/upstream/memberships.ts`** — must stay header-free (it already is, by construction). Add a
comment stating why: sending the header would narrow the very query that discovers the scope, and a
stale id would 403 the whole request at authentication time. Lock it with a test.

**Switch every handler** from the hand-built object to `context.upstream`: `charges.ts:191`,
`lookups.ts:86` and `:155`, `reports.ts:112`.

---

## Phase 3 — MCP: fix the two scoping bugs

**`src/tools/charges.ts`** — in `buildFilters`, `filters.byOwners = [...businessIds]` instead of
`byBusinesses`, with a comment explaining the counterparty-vs-owner distinction and the
`array_remove` upstream. Keep the explicit predicate even though RLS now also enforces it — defence
in depth, and it keeps the tool correct if upstream ever runs with a scope-bypassing role.

**`src/tools/reports.ts:102`** — use `input.businessId` as the owner, and assert
`context.readScope.businessIds.includes(ownerId)` defensively rather than deriving the owner from
the scope.

---

## Phase 4 — MCP: discovery tool `accounter_list_businesses`

**Carry `businessName` through the membership pipeline** — no extra upstream call; reuse what
`authenticate()` already fetched. `MyBusinessMembership` already exposes `businessName`
(`packages/server/src/modules/auth/typeDefs/auth.graphql.ts:26`), the MCP just doesn't select it.

- `src/upstream/memberships.ts`: add `businessName` to `MY_MEMBERSHIPS_QUERY`; replace the
  doc-comment that currently justifies _not_ selecting it.
- `src/auth/identity.ts`: add `businessName?: string | null` to `BusinessMembership`; in
  `coerceMembership`, accept `businessName`/`business_name` when it is a string, else `undefined`.
  Do **not** reject the entry on a malformed name (unlike `roleId`) — a bad display name must never
  drop a real membership.

**New `src/tools/businesses.ts`**

- `LIST_BUSINESSES_TOOL_NAME = 'accounter_list_businesses'`; input `z.object({})`.
- Policy `{ requiresBusinessScope: false, dataClassification: 'business' }` — deliberately `false`
  so a caller with zero memberships gets an empty list plus a helpful summary rather than
  `AUTHORIZATION_ERROR`.
- Handler is pure — no upstream call. Maps `context.auth.memberships` →
  `{ businessId, name, role }`, sorted by name then id (reuse the fixed-locale collator pattern from
  `lookups.ts`), returned via `shapeListResult({ itemsKey: 'businesses', … })`.
- Description: _"List the businesses you have access to, with your role in each. Call this first
  when you may have access to more than one business, then pass the returned `businessId` values as
  `businessIds` to the other tools. Read-only; takes no parameters."_

**Register it first** in `src/tools/registry-instance.ts` — `describe()` preserves registration
order, and `tools/list` ordering is a real prompt-engineering lever.

Note in `docs/connector-gaps-and-decisions.md` that when `MCP_TOOL_ALLOWLIST` enforcement lands (gap
§2 — parsed but unused), this tool must be in the default allowlist or discovery breaks.

---

## Phase 5 — MCP: uniform input, owner-tagged rows, echoed scope

**One shared schema fragment** (new `src/tools/scope-input.ts`, to avoid coupling the registry to
zod):

```ts
export const businessIdsInput = z
  .array(z.string().min(1))
  .max(50)
  .optional()
  .describe(
    'Limit results to these business (owner) ids — must be a subset of the businesses you belong to. ' +
      'Omit to include all of them. Use accounter_list_businesses to discover ids. ' +
      'Every returned row carries its ownerId so results can be grouped by business.'
  )
```

Used verbatim in `charges.ts` (replacing the bespoke field) and in **both** `lookups.ts` tools (new
field); `reports.ts`'s singular `businessId` gets a matching description. `requestedBusinessIds()`
in `execute.ts` already picks up either shape — no plumbing change needed.

**Owner on every row**

- Tax categories: add `ownerId` to `LIST_TAX_CATEGORIES_QUERY` and `RawTaxCategory`. Nothing else —
  `filterSortCap` returns raw rows as-is, and
  `ownerId: dbFinancialEntity => dbFinancialEntity.owner_id` already exists at
  `packages/server/src/modules/financial-entities/resolvers/common.ts:22`.
- Tags: add `ownerId` to `LIST_TAGS_QUERY`, `RawTag`, and the projected objects. **Depends on
  Phase 1.**
- Charges: add `owner { id name }` to `SEARCH_CHARGES_QUERY` (`Charge.owner: Business!` already
  exists, `businesses.graphql.ts:210` — no server change), add it to `RawCharge`, and emit
  `ownerId`/`ownerName` from `normalizeCharge` using optional chaining so existing test/perf
  fixtures that omit `owner` keep passing.

**Echo the effective scope** — every business-scoped tool adds
`scope: { businessIds: context.readScope.businessIds }` to `shapeListResult`'s `extra`.
(`shapeListResult` spreads `extra` first and framework keys win, so `scope` can't collide with
`charges`/`returnedCount`/`continuation`.) `accounter_list_businesses` doesn't echo a scope — it
_is_ the scope. Also fold the business count into `charges.ts`'s summary text when `n > 1`; the text
content is what the model reads first.

**Descriptions teach the workflow** — a consistent trailing clause on all four existing tools:
_"Scope: omitting `businessIds` covers every business you belong to; results are tagged with
`ownerId` and the response echoes the effective `scope.businessIds`. If you have more than one
business, call `accounter_list_businesses` first and pass explicit ids."_

---

## Phase 6 — tests

**Update**

- `src/tools/__tests__/charges.test.ts` — lines 86 and 94 assert `filters.byBusinesses`; retarget to
  `byOwners`, and add a regression guard that `byBusinesses` is **absent** (the wrong key fails
  silently by returning empty). Add `ownerId`/`ownerName` on normalized charges and
  `structuredContent.scope.businessIds`.
- `src/tools/__tests__/lookups.test.ts` — extend `clientReturning` to capture `init` so the header
  can be asserted. Add: `businessIds` narrowing accepted and reflected in `scope`; ids outside
  memberships denied; `ownerId` passthrough on both tools.
- `src/tools/__tests__/reports.test.ts` — assert the `ownerId` variable tracks `input.businessId`.
- `src/upstream/__tests__/graphql-client.test.ts` — the header block (lines 24–49): header sent
  comma-joined when `businessScope` is set; header **absent** when it is `undefined` _or_ `[]`.
- `src/upstream/__tests__/memberships.test.ts` — `businessName` selected and coerced; the bootstrap
  request carries **no** `x-business-scope`.
- `src/auth/__tests__/identity.test.ts` — `coerceMembership` accepts `businessName`/`business_name`
  and tolerates a missing/malformed one without dropping the membership.
- `src/__tests__/mcp-e2e.test.ts` — `upstreamData` fixtures (lines 56–103) gain `businessName`,
  charge `owner`, and tags/tax-category `ownerId`; the `tools/list` assertion (line 218) gains
  `accounter_list_businesses`; `fakeUpstreamClient.query` (line 106) asserts `context.businessScope`
  equals `[AUTHORIZED_BUSINESS]` for tool calls and is `undefined` for the `myMemberships` call.
- `src/__tests__/perf.test.ts` — charge fixtures lack `owner`; the optional chaining keeps it green,
  but re-run to confirm `P95_TARGET_MS` still holds with the larger payload.

**Add**

- `src/tools/__tests__/businesses.test.ts` — sorting, empty-membership case returns a non-error
  empty list, no upstream call made, unknown input fields rejected.
- `src/tools/__tests__/scope-forwarding.test.ts` — **the cross-cutting guard.** Iterate
  `toolRegistry.list()`, run each tool with a capturing fake client and a two-business auth context,
  assert every tool that hits upstream sends `x-business-scope` with the resolved ids and echoes
  `scope.businessIds`. This is what stops a future tool from silently regressing.
- A byte-budget test: 500 tags each carrying `ownerId` still yields valid JSON, `truncated: true`,
  and `continuation.reason === 'payload_size'`.

The tags server module has no unit tests; Phase 1 is covered by typecheck + codegen, optionally
asserting `schema.graphql` contains `ownerId: UUID!` inside `type Tag`.

---

## Phase 7 — docs

- `packages/mcp-server/README.md` — "four curated tools" (line 22) becomes five; add the
  `accounter_list_businesses` bullet and the `businessIds`/`ownerId`/`scope` contract to the other
  four (§Tools, line 32). §Upstream GraphQL client (line 64): header propagation now lists
  `x-business-scope`. §Identity & tenant scope (line 74): document that the resolved read scope is
  forwarded and **RLS upstream is the enforcement point**, with MCP-side narrowing as the first
  gate. §Smoke test (line 203): `accounter_list_businesses` as step 0.
- `packages/mcp-server/docs/spec.md` §7.3 "Scope Narrowing" (line 197) — the forwarding rule and the
  self-describing-response contract.
- `packages/mcp-server/docs/local-development.md` §6 Verify (line 106) — the end-to-end scope check
  below.
- `packages/mcp-server/docs/connector-gaps-and-decisions.md` — record the Phase 0 view/RLS finding
  and the stateless-vs-stateful decision.
- `packages/mcp-server/docs/submission-checklist.md:40` — tool list.

---

## Risks

**`FORBIDDEN` throw path.** `applyRequestedReadScope` throws `FORBIDDEN` on a malformed header or
any id outside memberships. Drift is bounded to a single request — both the MCP `readScope` and the
server's memberships derive from `business_users`, and the MCP resolves memberships at the start of
the very request that then sends the header. Two consequences worth knowing: sub-second drift now
surfaces as `UPSTREAM_ERROR` rather than the more legible `AUTHORIZATION_ERROR` (acceptable — fails
closed); and `parseBusinessScopeHeader` requires strict UUIDs, so a dev/fixture environment with
non-UUID business ids will hard-fail every tool call. Don't "fix" that by filtering ids before
joining — silently dropping ids is exactly the failure mode `narrowReadScope` exists to prevent.

**Write-target re-pointing.** `applyRequestedReadScope` also calls `resolveWriteTargetBusinessId`
and can move `tenant.businessId`. A no-op when MCP sends all memberships; harmless for phase-1
read-only tools; a live concern the moment MCP gets write tools. Note it in the spec.

**Byte budget.** `MAX_TOOL_RESULT_BYTES = 60_000`; `ownerId` costs ~50 bytes/row. Negligible for
charges (≤50 rows) and balance rows. **Tags and tax categories at `limit: 500` are the pinch point**
— already near the cap, and `ownerId` pushes ~25 KB over. `shapeListResult`'s binary search degrades
safely (whole rows dropped, valid JSON, `continuation.reason`), but callers see fewer rows. Keep the
plain per-row `ownerId` (index-encoding forces the model to join; grouping by business breaks
per-item granularity), cover it with the test above, and consider dropping the lookups' _default_
`limit` from 500 to ~200 so the common call is truncation-free.

**No codegen in `packages/mcp-server`** — queries are hand-written strings, so they can drift from
the schema silently. The e2e fixtures are the only guard; keep them accurate.

---

## Verification

1. `yarn workspace @accounter/mcp-server test` + typecheck; `yarn workspace @accounter/server test`;
   `yarn lint`.
2. Local upstream + MCP per `packages/mcp-server/docs/local-development.md` §1–§3, then the `curl`
   smoke sequence in the package README, extended:
   - `accounter_list_businesses` → ≥1 row with `name` and `role`.
   - `accounter_search_charges` with no `businessIds` → `scope.businessIds` = all memberships,
     `ownerId` on every charge, **non-zero results** (this is the `byOwners` fix visibly working).
   - Same call with `businessIds: ["<id>"]` → a strict subset and a narrowed `scope`.
   - `accounter_list_tags` with a single `businessIds` → only that business's tags (the Phase 0 /
     RLS check).
   - A bogus UUID in `businessIds` → `AUTHORIZATION_ERROR` from the MCP policy, **not**
     `UPSTREAM_ERROR` — confirming MCP is still the first gate.
3. Confirm the header is doing the work server-side: tail the GraphQL server and check
   `app.current_business_scope` is set per request; or temporarily disable the MCP-side `byOwners`
   filter and re-run — if RLS is working, results stay scoped.
4. Full loop via cloudflared + Claude Desktop (`packages/mcp-server/docs/local-development.md`
   §4–§6) with a **two-business** test account: ask "compare my businesses" and confirm the model
   calls `accounter_list_businesses` first, then either passes explicit ids or groups correctly by
   the returned `ownerId`. Check `/metrics` for `accounter_list_businesses|success` and no new
   `authFailuresTotal`.
