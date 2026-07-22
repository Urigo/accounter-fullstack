# AllCharges Performance Audit — Findings

Audit of the `AllCharges` GraphQL query (All Charges screen), combining a static code review of the
full request lifecycle with runtime profiling via OpenTelemetry + Jaeger.

**Measured baseline (local dev, remote prod DB): 23.95s total, 366 spans, ~290 sequential DB round
trips.**

## Request lifecycle map

### Client

- **Operation**: `AllCharges` defined inline in
  `packages/client/src/components/screens/charges/all-charges.tsx` — pages of 100 charges,
  `pause: true`, refetched via effect with `requestPolicy: 'network-only'` on every filter/page
  change.
- **Fragment**: `ChargeForChargesTableFields`
  (`packages/client/src/components/charges/charges-table.tsx`) requests per charge: 6 date fields,
  `totalAmount`, `vat`, `counterparty`, `tags`, `taxCategory`, `validationData.missingInfo`,
  `missingInfoSuggestions`, and `metadata` counts. `metadata.invalidLedger` is behind `@defer`
  (server supports it via `useDeferStream`).
- **Caching**: the urql client (`packages/client/src/providers/urql.tsx`) has no `cacheExchange` —
  exchanges are `mapExchange` → `authExchange` → `fetchExchange`. Every query is a network
  round-trip (moot for this screen, which forces `network-only` anyway).
- Render churn is already mitigated (`useStableValue`, loading overlay instead of unmount).

### Server

- **Entry resolver**: `allCharges`
  (`packages/server/src/modules/charges/resolvers/charges.resolver.ts:133`) calls
  `ChargesProvider.getChargesByFilters` — a ~460-line SQL
  (`packages/server/src/modules/charges/providers/charges.provider.ts:175`) that filters charges,
  builds per-charge aggregates in CTEs (`transactions_by_charge`, `documents_by_charge`,
  `businesses_by_charge`, `tags_by_charge`, `ledger_by_charge`) into `enriched_charges`, applies
  post-aggregate filters, and sorts.
- **No `LIMIT` in the SQL** — the resolver fetches the entire enriched, sorted result set and
  paginates in JS (`filteredCharges.slice(...)`). Full enrichment runs for every matching charge on
  every page view, just to return 100 rows and a count.
- If `filters.byChargeTypes` is set, `getChargeType` runs over every fetched charge before slicing.

### Data access

- All DB access goes through `TenantAwareDBClient`
  (`packages/server/src/modules/app-providers/tenant-db-client.ts`), which wraps **every**
  stand-alone query in `BEGIN` → RLS `set_config` → query → `COMMIT` and serializes top-level
  queries through a mutex.

## Findings

### F1. Per-query transaction wrapping + serialization (runtime finding, dominant)

Confirmed by the Jaeger trace: every logical query appears as a `BEGIN` / `SELECT` (RLS) / query /
`COMMIT` sequence, each leg costing ~74ms (network RTT to the remote DB — even `BEGIN` costs 74ms,
which is pure latency). One logical query = 4–5 round trips ≈ 300–370ms. The mutex in
`TenantAwareDBClient.transaction()` serializes top-level queries, so nothing overlaps — the trace
waterfall is strictly sequential.

Trace math: 23.95s − 1.72s (main query) − 0.5s (initial pool connect) ≈ 21.7s ÷ 74ms ≈ **~290
sequential round trips** for ~90 logical queries.

> **Caveat**: locally the server talks to a remote DB (~74ms RTT). In production (co-located, ~1ms
> RTT) the same request is likely ~2–4s. The local setup amplifies the structural problem ~50×,
> making the query-count pathology visible.

### F2. Field resolvers discard the enriched SQL columns

`getChargesByFilters` already computes `transactions_min_event_date`, `documents_count`,
`ledger_count`, `event_amount`, `documents_vat_amount`, `tags`, etc. — and passes the enriched rows
as GraphQL parents. Yet every field resolver ignores those columns and recomputes from scratch via
DataLoaders:

- `minEventDate` / `minDebitDate` / `maxEventDate` / `maxDebitDate` / `minDocumentsDate` /
  `maxDocumentsDate` / `vat` / `totalAmount`
  (`packages/server/src/modules/charges/resolvers/common.ts`) call `getChargeTransactionsMeta` /
  `getChargeDocumentsMeta` / `calculateTotalAmount`, which load **all transaction and document
  rows** per charge and re-aggregate in JS
  (`packages/server/src/modules/charges/helpers/common.helper.ts`).
- `metadata.*Count` fields (`charges.resolver.ts:728-850`) load full
  transactions/documents/ledger/misc-expense row sets just to call `.length`.
- `validationData` → `validateCharge`
  (`packages/server/src/modules/charges/helpers/validate.helper.ts`) → `getChargeType` +
  `getChargeBusinesses` (loads transactions + documents + ledger + misc-expenses) +
  `getChargeTaxCategoryId` + per-invoice `validateDocumentAllocation`.

DataLoaders keep this from being an unbatched N+1, but the shape is "load every child row of 100
charges across 5+ tables and re-aggregate in JS" — duplicating work the SQL already did, and paying
F1's round-trip tax for each batch.

### F3. `invalidLedger` regenerates the ledger for 100 charges per page view

`metadata.invalidLedger` (`charges.resolver.ts:788`) runs full ledger regeneration
(`ledgerGenerationByCharge`) plus a stored-ledger comparison for each charge on the page. It is
`@defer`red, so first paint isn't blocked, but the deferred patch costs ~100 ledger generations of
DB + CPU per page view and produces the long tail of queries visible across most of the 24s trace.

### F4. No SQL pagination

The main query (1.72s in the trace) enriches and sorts the entire matching corpus; the resolver
slices 100 rows in JS. Cost scales with corpus size, not page size.

### F5. Unprimed charge loader (redundant re-fetch)

`getChargesByFilters` never primes `ChargesProvider.getChargeByIdLoader`, so helpers calling
`.load(chargeId)` trigger a redundant batched `SELECT * FROM charges WHERE id IN (...)` re-fetching
the same 100 charges the main query just returned (visible in the trace right after the `WITH`
query).

### F6. `missingInfoSuggestions` runs eagerly per row

`packages/server/src/modules/charges/resolvers/charge-suggestions/charge-suggestions.resolver.ts`
runs for every charge missing tags/description — repeating `calculateTotalAmount` +
`getChargeBusinesses` and more per row, in the critical (non-deferred) path.

### F7. `__isTypeOf` chain re-runs `getChargeType`

Charge `__typename` resolution runs up to 10 sequential `__isTypeOf` checks per charge, each calling
`getChargeType` (cheap when `charge.type` is set; a loader cascade when null). No per-request
memoization.

### F8. Telemetry exporter URL bug (found while setting up profiling)

`packages/server/src/telemetry/builder.ts:94` passes `env.otel.exporterEndpoint` directly as `url`
to `OTLPTraceExporter`. With an explicit `url` the exporter does **not** append `/v1/traces`, so the
template value (`http://localhost:4317`, also the wrong gRPC port for an HTTP exporter) silently
exports nothing. Workaround used: set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces`.
`.env.template` and/or the builder should be fixed.

## Jaeger trace summary (baseline)

| Metric                        | Value                                       |
| ----------------------------- | ------------------------------------------- |
| Total duration                | 23.95s                                      |
| Total spans                   | 366                                         |
| Initial `pg-pool.connect`     | 501ms (TLS handshake; later checkouts ~1ms) |
| Main `WITH` query             | 1.72s (~7% of total)                        |
| Typical query span            | ~74ms (uniform — network RTT bound)         |
| Per-logical-query round trips | 4–5 (`BEGIN`, RLS `SET`, query, `COMMIT`)   |
| Estimated sequential RTs      | ~290                                        |
| Concurrency                   | None — queries strictly serialized          |

Profiling setup: Jaeger all-in-one (OTLP HTTP :4318), `OTEL_ENABLED=1`,
`OTEL_TRACES_SAMPLER=parentbased_always_on`. Traces appear under service `accounter-server`.

## Results

Same AllCharges filter/page re-traced after each enhancement step.

| Step                                      | Duration | Trace shape                                                                                                                  |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Baseline                                  | 23.95s   | 366 spans; every query wrapped in BEGIN/SET/COMMIT, serialized                                                               |
| Step 1 — request-scoped DB transaction    | ~8.2s    | One connect + one BEGIN + one RLS SET for the whole request; bare sequential SELECTs (~75ms RTT each); main WITH query 1.86s |
| Step 2 — parent-aware resolvers + priming | ~8.3s    | Initial-phase batched loader queries gone (~10 fewer); total unchanged within RTT noise — the per-charge staircase dominates |

Remaining cost after step 2 is the sequential per-charge staircase (~70 × ~75ms):
`missingInfoSuggestions` runs `getSimilarCharges` per suggestion-needing charge in the non-deferred
path (blocks first render — step 5), and the deferred `invalidLedger` issues several queries per
charge for ledger generation (step 3). Step 2 still cut ~10 queries, DB load, and JS re-aggregation,
and its enriched fast path is what steps 3/5 build on. The main query (1.75s) remains step 4.
