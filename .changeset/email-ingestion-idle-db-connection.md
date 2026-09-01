---
'@accounter/server': patch
---

Survive a pooled DB connection that died while idle, instead of failing the first request after a
quiet period.

Over two days the email-ingestion gateway's `requestIngestControl` call failed five times, and every
failure was the first request a freshly started gateway process made — roughly 1 in 3 cold starts,
never twice in a row. The gateway's own timings prove the server *answered* rather than refusing the
connection, and DB queries confirmed the resolver threw between `resolveAlias` and `issueGrant`.
Every step in that window goes through `withTenantContext`.

That is the signature of a pooled connection killed by the database or a network middlebox while it
sat idle: it stays in the pool, the next checkout hands it out, the first query fails immediately
(`Connection terminated unexpectedly` / `ECONNRESET`), `pg` discards it, and everything afterwards
works.

Two mitigations:

- The pool's `idleTimeoutMillis` is now set explicitly and configurable via
  `POSTGRES_IDLE_TIMEOUT_MS` (default 10 s, which is pg's own default — now pinned so it cannot
  drift above a DB or middlebox idle cutoff).
- `withTenantContext` retries once on a fresh connection when it is handed a dead one. The retry is
  narrow by construction: only a connection-level failure (a statement error such as a constraint
  violation is never replayed), never once `COMMIT` is in flight (the transaction's outcome is
  unknown there, so it is re-thrown as `UnknownCommitOutcomeError`), and only once. A broken
  connection is now released *with* its error so the pool destroys it rather than handing it to the
  next caller.

Independently, the control resolver's catch-all now logs before rethrowing. A server-side exception
there previously produced no server-side log line at all and only a generic message on the wire,
which is why this had to be inferred from client-side timing in the first place. This matches what
the ingest resolver already does.

This is not specific to email ingestion — the same stale connection would fail the first
user-facing request after any idle period, just less visibly.
