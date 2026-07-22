---
'@accounter/server': patch
---

Make `TenantAwareDBClient` hold one pooled connection and one open transaction per GraphQL request
instead of per query.

Previously every stand-alone query paid `BEGIN` → RLS `set_config` → query → `COMMIT` — four to five
round trips for one logical read. The client now opens a session lazily on the first query, sets the
RLS variables once, and reuses it for the rest of the request, collapsing that to roughly one round
trip per query. On the AllCharges screen, which issues ~90 logical queries per request, this is the
dominant cost. Queries are still serialized through the existing mutex (one connection per request),
so the win is fewer round trips, not parallel execution.

Semantics are preserved:

- Data-modifying stand-alone queries and the outermost explicit `transaction()` scope commit
  immediately, so a mutation response always reflects durable state.
- Nested `transaction()` scopes keep their SAVEPOINT isolation.
- A failed statement rolls the session back, and the next query starts a fresh one.
- `dbCleanupPlugin` disposes the client once the response — including any `@defer`/`@stream` tail —
  is fully sent, committing any open read session and releasing the connection.

Clients constructed outside the GraphQL request lifecycle (no `CONTEXT` injection — test harnesses,
scripts) default to the previous commit-and-release-per-operation behavior, since nothing would ever
call `dispose()` and the held connection would otherwise leak from the pool.
