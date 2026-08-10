---
'@accounter/scraper-app': patch
'@accounter/server': patch
---

Align the MAX credit card ingestion path with what MAX actually returns.

The Zod payload schema for MAX was `.loose()` and covered only a handful of fields, so the nested
`dealData`, `merchantData` and `runtimeReference` blocks were never validated and were passed
through to the GraphQL mutation unflattened. `max.schema.ts` now models the full transaction
strictly, and `maxVars` flattens those nested blocks into the `MaxTransactionInput` columns the
server expects.

MAX omits large parts of `dealData` for some transaction types, so the `MaxTransactionInput` fields
backing those columns are now nullable, and the numeric ones (`dealDataAmount`, `dealDataAmountIls`,
`dealDataExchangeRate`, `originalAmount`, …) are typed as `Float` rather than `String`. Boolean
fields backing `bit` columns are converted to `1`/`0` via a new `convertBooleanToBit` helper —
previously a JS boolean was sent to a `bit` column, which Postgres rejects.

Also fixes a few typing gaps in `scraper-app` that surfaced alongside this: the upload client
derives its result types from the generated mutation types instead of a hand-maintained
`ScraperUploadResult`, `filterPayload` handles the two `otsar-hahayal` source types instead of
falling through, the config screen gets an explicit `CONFIGURABLE_SOURCE_TYPES` list, and the
package's tsconfig resolves `@accounter/modern-poalim-scraper` to its build output.
