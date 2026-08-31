---
'@accounter-helper/migrations': patch
'@accounter/server': patch
---

Re-assert row-level security on `accounter_schema.salaries`, and add the coverage that would have
caught it missing.

A production catalog snapshot reported `salaries` as the only `owner_id`-carrying table in
`accounter_schema` with RLS off. The repo's migration history does not explain that: `salaries` is
listed in all three migrations that built the current tenant isolation setup —
`enable-rls-all-tables` (ENABLE + FORCE + policy), `rls-multi-business-scope` (the multi-business
read predicate) and `rls-delete-write-target` (the restrictive DELETE policy) — and running the full
migration set into an empty database produces a table that is enabled, forced and policied. Nothing
in the repo turns it off: no migration issues `DISABLE`/`NO FORCE` against it, and no application,
seed or script path does either. The remaining explanation is catalog drift on that server.
`relrowsecurity` and `relforcerowsecurity` are per-table flags that a manual `ALTER TABLE`, or a
restore that replayed DDL without them, can clear while leaving the policy objects intact — and a
policy on a table with RLS disabled is inert, which matches the reported symptom exactly.

`2026-08-31T12-00-00.rls-reassert-salaries.sql` is therefore a re-assertion rather than a first-time
enable. Every statement is idempotent: a no-op against a database built from the migration history,
corrective against a drifted one. The policy predicates are byte-identical to the migrations that own
them, so tenant scoping cannot be silently redefined. `FORCE` is load-bearing, not decorative:
`accounter_prod_user` inherits from `prod_group`, which owns these tables, and a table owner is exempt
from its own policies unless the table is forced, so `ENABLE` alone would leave the application role
reading every tenant's rows.

The exposure was latent, not active. Production holds a single `owner_id` across 258 salary rows, so
no cross-tenant read was possible and the vacation and recovery reserve calculations — which read
salaries over a deliberately unbounded range in `ledger/helpers/vacation-reserve.helper.ts` and
`recovery-reserve.helper.ts` — were not contaminated. It would have become both a leak and a source of
wrong financial figures the moment a second business recorded salary data.

Two tests close the gap that let this go unnoticed. `rls-all-tables.test.ts` previously asserted
isolation only on `charges`; it now also checks a catalog invariant — every table in
`accounter_schema` carrying an `owner_id` has RLS enabled *and* forced with a `tenant_isolation`
policy — derived from the catalog rather than a hardcoded list, so new tenant tables are covered as
they land. `rls-salaries-visibility.integration.test.ts` adds the two-tenant read-visibility assertion
for `salaries`, run as a non-superuser role (the test pool connects as `postgres`, which has
`BYPASSRLS`, so a test that does not drop privileges proves nothing). Verified to fail when RLS is
disabled on the table and to pass once the migration restores it.

No `NOT NULL` constraint is added: `salaries.owner_id` already carries one, so no row could be
stranded by the policy. All access to the table goes through `SalariesProvider`, which uses
`TenantAwareDBClient` exclusively; no cron job, batch or internal path reaches it without the tenant
GUCs set.
