# AllCharges Performance Enhancement Plan

Ordered by expected impact, informed by the Jaeger baseline (see `findings.md`). Each step is
independently shippable; re-profile after each one (same filter, same page) and compare total
duration + span count against the baseline (366 spans → target under ~80).

## Step 1 — Request-scoped DB transaction (fixes F1, dominant)

**Problem**: `TenantAwareDBClient` wraps every stand-alone query in `BEGIN` → RLS `set_config` →
query → `COMMIT` (4–5 round trips each) and serializes top-level queries through a mutex.

**Change**:

- `packages/server/src/modules/app-providers/tenant-db-client.ts` — open one client + transaction
  lazily on the first query of a GraphQL request (RLS variables set once), reuse it for all
  subsequent queries in the request, keep the existing SAVEPOINT nesting for explicit
  `transaction()` scopes.
- `packages/server/src/plugins/db-cleanup-plugin.ts` — dispose the request-scoped client at request
  end (including after any `@defer`/`@stream` tail): `dispose()` commits any open read session and
  releases the connection. Error handling happens mid-request, not here — a failed statement rolls
  the session back immediately, and data-modifying work is committed as soon as it succeeds.

**Care points**: mutation semantics (explicit `transaction()` calls must still get savepoint
isolation), long-lived `@defer` streams (client held until stream end), disposal on aborted
requests.

**Expected**: collapses 4–5 round trips per logical query to ~1 (BEGIN + RLS `set_config` run once
per request instead of per query). Queries remain serialized through the mutex — the request shares
a single pooled connection — so the win is fewer round trips per query, not parallel execution.
Biggest single win.

## Step 2 — Parent-aware field resolvers + loader priming (fixes F2, F5)

**Problem**: field resolvers discard the aggregates the `getChargesByFilters` SQL already computed
and re-derive them by loading all child rows (transactions, documents, ledger, misc-expenses) per
charge; the charge-by-id loader is never primed, causing a redundant re-SELECT of the same 100
charges.

**Change**:

- `packages/server/src/modules/charges/providers/charges.provider.ts` — prime `getChargeByIdLoader`
  with each row returned by `getChargesByFilters`.
- `packages/server/src/modules/charges/resolvers/common.ts` and `charges.resolver.ts`
  (`ChargeMetadata` counts) — when the parent row carries the enriched columns
  (`transactions_min_event_date`, `documents_count`, `ledger_count`, `event_amount`,
  `documents_vat_amount`, `tags`, …), use them directly; fall back to the existing loader path for
  parents from other sources (e.g. `charge` by id). Implement via a small type-guard helper on the
  parent shape.

**Expected**: removes most child-table batch loads and JS re-aggregation for this screen; no schema
change, no behavior change.

## Step 3 — Tame `invalidLedger` + memoize `getChargeType` (fixes F3, F7)

**Change**:

- `charges.resolver.ts` `ChargeMetadata.invalidLedger` — short-circuit charges with no transactions,
  documents, and ledger records (skip full ledger generation).
- `packages/server/src/modules/charges/helpers/charge-type.ts` — per-request memoization of
  `getChargeType` by charge id (request-scoped Map), deduplicating the up-to-10 `__isTypeOf` probes
  per charge and repeat calls in validation/suggestions.

**Longer-term option (not in this pass)**: persist a `ledger_validation` status invalidated on
charge mutation instead of recomputing on read.

## Step 4 — SQL pagination for `getChargesByFilters` (fixes F4)

**Change**: add `LIMIT $limit OFFSET $offset` + `count(*) OVER()` (or count CTE) to the query in
`charges.provider.ts`; resolver passes page/limit through and stops slicing in JS. Push the common
`byChargeTypes` cases into SQL (`type` column covers explicitly-typed charges; only null-type
charges still need JS resolution — handle by over-fetching or accepting approximate counts for that
filter).

**Expected**: enrichment cost scales with page size (100) instead of corpus size; main query drops
well below the measured 1.72s.

## Step 5 — Defer `missingInfoSuggestions` on the client (fixes F6)

**Change**: in `packages/client/src/components/charges/charges-table.tsx`, move the
`missingInfoSuggestions` selection behind `... on Charge @defer` (same pattern as `invalidLedger`);
run `yarn generate`. First paint stops waiting on per-row suggestion computation.

## Step 6 — Telemetry fixes (fixes F8, housekeeping)

**Change**:

- `packages/server/src/telemetry/builder.ts` — append `/v1/traces` when the configured OTLP endpoint
  has no path.
- `.env.template` — correct the example endpoint (`4317` gRPC → proper HTTP URL).

## Verification (every step)

1. `yarn lint`, `yarn generate`, `yarn test` (server unit tests; integration where DB available).
2. Re-run the AllCharges page with the identical filter/page used for the baseline; capture a Jaeger
   trace; record total duration + span count in a results table appended to `findings.md`.
3. Sanity-check UI: rows render, counts/dates/amounts match pre-change values, deferred
   `invalidLedger` badge still arrives.
