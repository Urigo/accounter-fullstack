---
'@accounter/green-invoice-graphql': patch
---

Fix the `Configuration file is not valid!` warnings printed by `mesh build`.

The `GreenInvoiceNew` source set `queryStringOptions` on its two operations, but Mesh's config
schema only accepts that key at handler level. Each operation failed both of the shapes an operation
may take: the HTTP shape rejected the unknown key and the PubSub shape wanted a `pubsubTopic`. The
runtime still honoured the per-operation options, so requests were unaffected.

The two operations need options that conflict, so they cannot share one handler-level setting:
`jsonStringify` (needed by `getFileUploadUrl`) would JSON-encode `getBankTransactions`'s `valueDate`
object. The source is split into `GreenInvoiceFileUpload` and `GreenInvoiceOpenBanking`, each with
its own handler-level `queryStringOptions`. The generated GraphQL schema, the SDK, and the query
strings sent to the API are unchanged.
