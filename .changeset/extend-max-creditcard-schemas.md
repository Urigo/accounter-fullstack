---
'@accounter/scraper-app': patch
'@accounter/server': patch
---

Align the MAX credit card ingestion path with what MAX actually returns.

The Zod payload schema for MAX was `.loose()` and covered only a handful of fields, so the nested
`dealData`, `merchantData` and `runtimeReference` blocks were never validated and were passed
through to the GraphQL mutation unflattened. `max.schema.ts` now models the full transaction
(strictly), and `maxVars` flattens the nested blocks into the `MaxTransactionInput` columns the
server expects.

MAX omits large parts of `dealData` for some transaction types, so the `MaxTransactionInput` fields
backing those columns are now nullable, and the numeric ones (`dealDataAmount`, `dealDataAmountIls`,
`dealDataExchangeRate`, `originalAmount`, …) are typed as `Float` rather than `String`. Boolean
fields backing `bit` columns are converted to `1`/`0` via a new `convertBooleanToBit` helper —
previously a JS boolean was sent to a `bit` column, which Postgres rejects.

A migration drops the matching `NOT NULL` constraints on
`accounter_schema.max_creditcard_transactions` and updates the insert trigger so the two NOT NULL
transaction columns fed from those fields keep working: `source_reference` falls back from `arn` to
`uid`, and `currency_rate` coalesces to its default of `0`. The MAX deduplication index is rebuilt
with `NULLS NOT DISTINCT` so that rows with a null `arn` or `payment_date` still dedup on
`ON CONFLICT`.
