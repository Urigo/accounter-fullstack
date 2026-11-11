---
'@accounter/green-invoice-graphql': minor
'@accounter/server': patch
---

Reuse Green Invoice access tokens across requests. The package adds `GreenInvoiceTokenCache`, which
caches a token per API key ID until 5 minutes before it expires and shares one token request between
concurrent callers, and `createGreenInvoiceSdk`, an SDK that takes its token from that cache on each
call and, if the API answers 401, drops the token and retries once with a new one.
`obtainAccessToken` and `isUnauthorizedError` are exported too; `init` is unchanged. The server now
keeps one app-wide token cache instead of requesting a new token for every GraphQL operation that
calls Green Invoice.
