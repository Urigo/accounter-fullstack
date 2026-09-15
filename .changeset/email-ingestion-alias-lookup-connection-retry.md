---
"@accounter/server": patch
---

Retry the email-ingestion alias lookup when the pooled DB connection died while idle.

The tenant-scoped DB calls in the `email-ingestion` module run through `withTenantContext`, which
retries once on a connection-level failure — a connection the database or a middlebox killed while
it sat idle in the pool, which is invisible until the first query is written to it. That retry
started one step too late.

`resolveAlias` is the first DB call the control path makes, and it runs on the raw pool rather than
through `withTenantContext` — deliberately, since it resolves an alias *to* a tenant and so cannot
pin a tenant context it does not yet have. It was therefore the one query in the module with no
protection, and being first, the one most likely to be handed a dead connection: the first request
after a quiet period failed and everything after it succeeded.

The gateway could not recover from it either. The control resolver's catch-all turns the dead socket
into a `GraphQLError`, which reaches the gateway as HTTP 200 with an `errors[]` array — a
`ClientError` whose status is 200, which the gateway's `isRetryable` declines (not `>= 500`, not one
of 408/425/429). So the widened control retry budget never engaged and the call failed after a
single attempt, leaving the inbound email to be rescued by the webhook's 503 and the Worker's
fallback forward: the mail reached a human, but the ingestion was lost and had to be replayed by
hand.

A new `withConnectionRetry` sits alongside `withTenantContext`, reusing the same
`isConnectionLevelError` taxonomy, and now wraps the alias lookup. It needs none of its sibling's
transactional care — there is no `BEGIN`/`COMMIT`, so no outcome can be ambiguous, and the call is a
`SELECT`, so repeating it cannot double a write. It stays just as narrow: only a connection-level
failure, and only once, so a genuinely unreachable database fails fast instead of doubling every
query.
