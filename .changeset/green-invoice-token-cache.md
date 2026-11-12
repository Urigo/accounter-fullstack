---
'@accounter/green-invoice-graphql': minor
'@accounter/server': patch
---

Reuse Green Invoice access tokens across requests. The package adds `GreenInvoiceTokenCache`, which
caches a token per API key ID until 5 minutes before it expires and shares one token request between
concurrent callers, and `createGreenInvoiceSdk`, an SDK that takes its token from that cache on each
call and, if the API answers 401, drops the token and retries once with a new one (a replacement that
is rejected too is dropped as well). The cache keeps only a hash of each secret, and
`invalidate(id)` evicts a removed key entirely. `obtainAccessToken` and `isUnauthorizedError` are
exported too; `init` is unchanged. The server now keeps one app-wide token cache instead of
requesting a new token for every GraphQL operation that calls Green Invoice, and clears it when
Green Invoice credentials are replaced or deleted. Each eviction (`invalidate(id)` or `clear()`)
advances the cache's `epoch`; an SDK built from credentials read before an eviction
(`createGreenInvoiceSdk`'s `epoch` option) gets uncached tokens, so a removed key can't put its token
back.
