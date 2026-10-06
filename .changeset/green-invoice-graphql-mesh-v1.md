---
'@accounter/green-invoice-graphql': minor
---

Migrate from GraphQL Mesh v0 to v1. The REST API is now composed with `mesh-compose` into a supergraph,
the typed SDK is generated with GraphQL Code Generator, and operations run in-process through
`@graphql-mesh/fusion-runtime`. The public API is unchanged (`init`, `getMeshSDK`, `Sdk` and the
generated type names), and the runtime Mesh dependencies drop from eight packages to two.
`getMeshSDK` also accepts an optional `fetch` in its context, for example to run tests offline.
The `GreenInvoiceNew` source is split into `GreenInvoiceFileUpload` and `GreenInvoiceOpenBanking`
so that each sets its `queryStringOptions` at source level, the only level Mesh's config accepts
(this also removes the `Configuration file is not valid!` warnings v0's `mesh build` printed). The
query strings sent to the API are unchanged.
