---
"@accounter/server": patch
---

Survive a dead pooled DB connection in the email-ingestion control path, and report it as a 503 so
the gateway retries.

Two gaps left over from the #4344 remediation, both in the window between "the connection died" and
"the inbound email is lost".

**The alias lookup had no retry.** The module's tenant-scoped DB calls run through
`withTenantContext`, which retries once on a connection-level failure. `resolveAlias` does not: it
runs on the raw pool, deliberately, since it resolves an alias *to* a tenant and so cannot pin a
tenant context it does not yet have. It was the one query in the module with no protection, and
being the first call in the control path, the one most likely to meet a connection that died while
idle. A new `withPoolReadRetry` now wraps it.

This is narrower than it was in the original incident: the pool's `idleTimeoutMillis` is 10 s, so
after a quiet period the pool is empty and the next request opens a fresh connection rather than
inheriting a corpse. What remains is a connection dying *inside* its sub-10 s idle window — a
database restart, a failover, an administrative kill — plus any deployment whose middlebox cutoff
sits below the configured `POSTGRES_IDLE_TIMEOUT_MS`. Those fail fast (`57P01`, `ECONNRESET`), which
is precisely when a retry helps; a connection dropped silently with no RST is not detected until TCP
keepalive notices, long past the gateway's 3 s control timeout, and no retry here can help that.

**A dead connection reported itself as a non-retryable HTTP 200.** Yoga answers a GraphQL error with
200, and the gateway's `isRetryable` declines a `ClientError` whose status is 200 — neither `>= 500`
nor one of 408/425/429. So control failed after a single attempt and the widened
`CONTROL_MAX_RETRIES` budget never engaged, for exactly the transient failure it was widened for.
The control resolver now sets `extensions.http.status = 503` when the cause is connection-level,
which yoga translates into a 503 and the gateway retries across its full budget. Retrying control is
safe: it has no side effect before `issueGrant`, which is the last step and is not reached when this
throws.

A rejected statement (constraint, RLS, syntax) is deliberately excluded from both mechanisms. It is
a real answer that will fail identically on every attempt, so it is neither retried locally nor
escalated to a 503 for the gateway to spend its budget on.
