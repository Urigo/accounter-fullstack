---
'@accounter/email-ingestion-gateway': patch
'@accounter/server': patch
---

Split `UPSTREAM_ERROR` out of `TRANSIENT_UPSTREAM`, and widen the control retry budget.

**The reason code was a catch-all.** `classifyFinalError` bucketed everything that was not a timeout
into `TRANSIENT_UPSTREAM`, so one code covered connection refused, DNS failure, TLS failure, any
5xx, any 4xx, every GraphQL error the server returned, and an empty response body. Two of those are
not transient at all: an HTTP 200 carrying a GraphQL `errors[]` array (how a server-side exception
surfaces through yoga) and a 4xx such as a misconfigured `GATEWAY_CP_TOKEN`. Both were reported as a
passing cloud, and an operator reading `TRANSIENT_UPSTREAM` would reasonably assume they would fix
themselves. In the incident behind #4344 the same signature recurred five times in two days and the
label actively slowed diagnosis.

`UPSTREAM_ERROR` now covers "the server answered and said no". `TRANSIENT_UPSTREAM` keeps the
transport failures and 5xx — a 5xx is the server failing rather than refusing, and is expected to
clear. `TIMEOUT` is unchanged. Added to both `contracts.ts` files with the parity tests updated
together, per the package convention.

`isRetryable` also stops keying purely on `status >= 500`: 408/425/429 are explicit "come back
later" statuses and are now retried, while every other 4xx stays terminal.

**The control retry budget was ~0.3 s.** `CONTROL_MAX_RETRIES = 2` with a 100 ms base gave backoff
of 100 ms then 200 ms — a 300 ms total sleep sitting under a 3000 ms per-attempt timeout, orders of
magnitude tighter than the timeout it guarded. Control is explicitly side-effect-free before
`issueGrant`, so that headroom was going unused.

Max retries is now 4 with a 250 ms base (250/500/1000/2000 ms), plus 25 % additive jitter so a burst
of arrivals — the logs show 6 webhooks within 2 s — does not retry in lockstep. The jitter source is
injectable, so backoff stays deterministic under test.

Ingest is deliberately untouched: `INGEST_MAX_RETRIES = 1` with `retryOnTimeout = false` is correct,
since the grant is single-use and a retry burns it.

Also routes a null `data` (a 200 whose body does not match the contract) into `UPSTREAM_ERROR`
rather than letting a `TypeError` fall through and be classified as a transport failure.
