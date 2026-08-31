---
'@accounter/server': patch
---

Pin the RLS business context in the demo and production seed scripts, which never set it.

The staging deploy failed at `yarn seed:staging-demo` with
`P0001: No business context set - authentication required`, raised from
`accounter_schema.get_current_business_id()` while evaluating `tenant_isolation` on
`financial_entities`.

Since `2026-05-12T09-00-00.enable-rls-all-tables`, every domain table is `ENABLE` + `FORCE ROW
LEVEL SECURITY` with policies whose predicates call `get_current_business_id()` — and that helper
raises rather than returning NULL when `app.current_business_id` is unset. Permissive policies are
OR'd but each branch is still evaluated, so no path tolerates a missing context, `allow_bootstrap_root`
included.

It went unnoticed for months because dev and CI connect as the `postgres` superuser, which bypasses
RLS regardless of `FORCE` — the point `packages/server/src/__tests__/helpers/rls-role.ts` already
makes in its header. A deployed database connects as a non-superuser, so the policies are actually
evaluated and the first `financial_entities` insert aborts. `yarn test:integration` and
`yarn test:demo-seed` both pass against a seed that cannot run on a real deploy.

The admin business id is deterministic (`makeUUID('business', 'Admin Business')`), so the context
can be pinned before the row it names exists — exactly the bootstrap dance `bootstrapNewClient`
already performs, and what `allow_bootstrap_root`'s `id = get_current_business_id()` clause is for.
Every seeded row is owned by that same business, so one context covers the whole run, and
`get_current_business_scope()` falls back to `ARRAY[get_current_business_id()]`, so the scope GUC
needs no separate handling.

- `scripts/seed-demo-data.ts` pins the context session-level rather than transaction-local: its
  reset and admin steps run outside any transaction, where `set_config(…, true)` would not survive
  past the statement that set it. It also asserts `seedAdminCore` returns the id that was pinned.
- `scripts/seed-demo-data.ts` now verifies the context **before** the destructive reset. That
  `TRUNCATE` is autocommitted, so failing after it left staging wiped rather than un-reseeded — which
  is what the failing deploy actually did to the environment.
- `validate-demo-data.ts` (`yarn validate:demo`, the deploy's next step) reads the same RLS'd tables
  and would have failed identically once the seed was fixed.
- `scripts/seed.ts` carried the same omission. It took the admin id from `RETURNING id`, which is too
  late to pin a context, so it now derives the id up front and inserts it explicitly. This makes the
  production seed's admin id deterministic where it was previously random.
- `fixture-loader.ts` no longer swallows a failed context set with `console.warn`. Under RLS that
  turned one clear failure into a cascade of policy violations naming nothing useful.

Adds `seed-admin-context-rls.integration.test.ts`, which runs `seedAdminCore` under the existing
non-superuser role helper: it succeeds with the context pinned and fails with `P0001` without it. It
lives under `src/__tests__/` so it runs in the `integration` project on pull requests — the
`demo-seed` project only runs on push to `main`, and both connect as superuser anyway.
