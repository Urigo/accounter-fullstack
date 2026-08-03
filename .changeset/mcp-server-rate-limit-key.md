---
'@accounter/mcp-server': patch
---

Key the rate limiter on `userId|toolName` instead of
`userId|sortedScope|toolName`. Sorting already defeated permutation abuse, but
distinct business-scope *subsets* still mapped to distinct buckets, so a caller
with N businesses could address up to 2^N−1 buckets per tool and multiply their
effective quota — now that two tools accept a `businessIds` input. Every subset
is already authorized, so scope in the key protected nothing and only fragmented
the quota it is meant to bound. Tenant isolation is unaffected: it is enforced
upstream by RLS via the forwarded `x-business-scope` header, not by the
rate-limit key.
