# Owner-Scoping Work — Review Report

Review of the completed owner/business-scoping effort on the `mcp-owner-scoping` branch, covering
all seven phases of
[`../../../docs/coherent-owner-scoping-for-mcp/plan.md`](../../../docs/coherent-owner-scoping-for-mcp/plan.md).

Reviewed 2026-08-02 against the merged branch tip, then re-checked after the branch was rebased onto
`main` (which brought in #4077 `TIMELESS_DATE` centralization and #4078 graphql-codegen for tool
operation types).

| Phase | Change                                                        | PR    |
| ----- | ------------------------------------------------------------- | ----- |
| 0     | RLS pre-flight on `extended_tags` (no code)                   | —     |
| 1     | `Tag.ownerId` via the `extended_tags` view                    | #4089 |
| 2     | Forward `x-business-scope` centrally                          | #4091 |
| 3     | Fix `byBusinesses` → `byOwners`; report on requested business | #4092 |
| 4     | `accounter_list_businesses` discovery tool                    | #4093 |
| 5     | Uniform scope input, owner-tagged rows, echoed scope          | #4094 |
| 6     | Registry-wide scope guard; smoke tool unadvertised            | #4095 |
| 7     | Documentation of the scoping contract                         | #4096 |

Outstanding items tracked in [`connector-gaps-and-decisions.md`](./connector-gaps-and-decisions.md)
are referenced rather than repeated. The findings below that remain open are carried into
[`todo.md`](./todo.md), which is the actionable list.

## Verification performed

All against the merged tree.

| Check                                           | Result                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `vitest run --project unit packages/mcp-server` | 34 files, 328 tests pass                                                                   |
| `yarn workspace @accounter/mcp-server build`    | exit 0                                                                                     |
| `yarn eslint packages/mcp-server/src`           | clean                                                                                      |
| `prettier --check` (src + docs)                 | clean                                                                                      |
| 5 MCP GraphQL documents vs `schema.graphql`     | 5 valid, 0 invalid                                                                         |
| Production migration state                      | `2026-08-01T10-00-00.extended-tags-owner-id.sql` applied; `extended_tags.owner_id` present |

## Findings

### F1 — Branch was behind `main`; `TaxCategory.isActive` had no resolver

**Was high. ✅ Resolved by rebasing onto `main` (2026-08-02).**

`main` carries #4090 (`0335b6e7b`), which added to
`packages/server/src/modules/financial-entities/resolvers/tax-categories.resolver.ts`:

```ts
isActive: parent => parent.is_active ?? true,
```

plus the equivalent mapping in the single-tax-category resolver. `mcp-owner-scoping` does not have
it. Both branches declare `TaxCategory.isActive: Boolean!` in the typeDefs, so on this branch the
field is non-null with **no field resolver** — the default resolver looks for `parent.isActive`
against a row that exposes `is_active`, producing a non-null violation.

`accounter_list_tax_categories` selects `isActive`, so that tool fails entirely against a server
built from this branch alone. Unit tests do not catch it: the tool suites stub `fetch`, so no real
resolver runs.

The branch never touched that file, so rebasing simply picked up main's version. Verified present
after the rebase.

### F2 — Rate-limit quota multiplies with scope subsets

**Medium. Introduced by Phase 5.**

`rateLimitKey` (`src/rate-limit/limiter.ts`) builds `userId|sortedScope|toolName`. Sorting the ids
defeats permutation abuse, but distinct _subsets_ remain distinct keys, each with its own quota.

Before Phase 5, `accounter_list_tags` and `accounter_list_tax_categories` accepted no `businessIds`,
so each had exactly one bucket per user. They now accept it, so a caller with N businesses can
address up to 2^N−1 buckets per tool.

This is not a tenant-isolation problem — every subset is already authorized, and the caller cannot
reach data they could not otherwise reach. It weakens abuse protection and upstream load control,
and it does so precisely on the tools that now push RLS-scoped work upstream. Memory is bounded by
the existing sweep (`SWEEP_EVERY = 1000`), so the concern is quota, not a leak.

**Options:** key the limiter on `userId|toolName`, or keep per-scope buckets and add a per-user
aggregate ceiling above them.

### F3 — Empty-scope widening path

**Medium. Documented; unreachable today.**

`executeOnce` filters falsy ids and then omits the header when none survive. Upstream reads an
absent `x-business-scope` as "all of the caller's memberships", so a scope consisting entirely of
blank entries would widen rather than narrow.

Verified unreachable **by construction rather than by guard**:

- `coerceMembership` rejects an empty `businessId` (`src/auth/identity.ts`);
- `readScopeFromMemberships` maps `membership.businessId` only;
- `narrowReadScope` pushes only ids present in the membership set, else returns `null`.

So a blank id cannot reach `readScope.businessIds` and cannot reach the client. This is recorded in
[`spec.md`](./spec.md) §7.3.1 together with the requirement that any change relaxing membership
coercion must also make the case fail closed.

**Option:** a two-line defensive guard in `executeOnce` would remove the dependency on that
invariant, at the cost of a branch that is dead today.

### F4 — Asymmetric bound on scope size

**Low.**

`MAX_REQUESTED_BUSINESS_IDS = 50` (`src/tools/scope-input.ts`) bounds _caller-requested_ ids. The
default scope — every membership — is uncapped and joined into the header, so a user with more than
50 memberships exceeds the stated cap through the default path.

No practical risk at current tenant sizes. Worth either applying a consistent bound or noting
explicitly that the cap is an input guard, not a scope guard.

### F5 — Carried gaps, re-verified as still open

- **Gap 2** — `MCP_TOOL_ALLOWLIST` is parsed into `env.server.toolAllowlist` and never read.
  Confirmed on the merged tree: the only references are `config/env.ts` and its tests. When
  enforcement lands, `accounter_list_businesses` must be in the default allowlist, or discovery
  disappears and every scoped call is left guessing — silently, since the other tools keep working.
- **Gap 8** — no CI validation of the MCP GraphQL documents. Closed by graphql-codegen: #4078 added
  `src/tools/*.ts` to the codegen `documents` list, and this branch adds `src/upstream/*.ts` so the
  membership bootstrap is covered too. Codegen exits non-zero on a bad field, and it runs in the
  shared CI setup action, so this fails every job rather than one dedicated check.

### F6 — Gap 1 remains the production blocker

Auth0 DCR interop (Auth0 returns `201`, Claude rejects the registration) still gates any published
connector and is not fixable in this repository. Gap 6 also stands: `submission-checklist.md` omits
client registration entirely, so it reads as complete while gap 1 is open.

## What the review confirms is sound

**Phase 0's premise held on production, not just locally.** `FORCE ROW LEVEL SECURITY` is set on
`tags`, `charges`, and `tax_categories`; the `tenant_isolation` policy resolves through the
`app.current_business_scope` session GUC; and the `extended_tags` view owner (`prod_group`) is
neither superuser nor `BYPASSRLS`. `FORCE` is the load-bearing part — `prod_group` owns the table,
and a table owner bypasses its own RLS without it.

**The migration is live in production.** `2026-08-01T10-00-00.extended-tags-owner-id.sql` is
recorded in `accounter_schema.migration` and `extended_tags.owner_id` exists, so the Phase 5
`ownerId` selection has its backing field. The deploy-ordering hazard between Phase 1 and Phase 5 is
already resolved.

**The forwarding guarantee is structural, not conventional.** The upstream context is built once in
`execute.ts` where the resolved scope is known, and handlers receive it — they cannot assemble one
that omits the scope. `scope-forwarding.test.ts` iterates `toolRegistry.list()` rather than a fixed
list, so a tool added later cannot silently opt out, and it asserts on outbound HTTP headers rather
than on the context object.

**The two load-bearing header rules are encoded and tested.** No header on an empty scope (an empty
one would widen), and out-of-scope ids rejected rather than dropped.

**Guards were mutation-verified, not assumed.** Each phase's regression test was checked by
reverting the fix and confirming the test fails. This caught one test that passed against the buggy
code — the balance-report owner check, which had to be driven through the handler directly because
the policy narrows the scope to exactly the requested business, making the two owner sources
indistinguishable through the normal path.

## Recommendation

The work is sound and ready to merge to `main`. Before it does:

1. ~~Settle F1~~ — done: the branch is rebased onto `main`.
2. **Decide on F2** — the quota change is a real behavioural regression in abuse protection, even
   though it is not a security one. Still open.
3. F3 and F4 are safe to defer; both are recorded with the conditions that would make them live.
