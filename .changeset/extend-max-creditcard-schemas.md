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

A migration drops the matching `NOT NULL` constraints on
`accounter_schema.max_creditcard_transactions`, so those payloads no longer fail at insert time, and
updates the insert trigger to keep the two NOT NULL `transactions` columns fed from now-nullable
sources working: `source_reference` falls back from `arn` to `uid`, and `currency_rate` coalesces to
its column default of `0`. The MAX deduplication index is rebuilt with `NULLS NOT DISTINCT` so rows
with a null `arn` or `payment_date` still dedup on `ON CONFLICT`.

Also fixes a few typing gaps in `scraper-app` that surfaced alongside this: the upload client
derives its result types from the generated mutation types instead of a hand-maintained
`ScraperUploadResult`, `filterPayload` handles the two `otsar-hahayal` source types instead of
falling through, the config screen gets an explicit `CONFIGURABLE_SOURCE_TYPES` list, and the
package's tsconfig resolves `@accounter/modern-poalim-scraper` to its build output.
