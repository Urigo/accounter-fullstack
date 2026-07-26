---
"@accounter/server": patch
"@accounter/client": patch
---

Optimize the VAT monthly report and the flows backed by `getVatRecords` (monthly-VAT ledger
validation, description suggestions, and PCN874 generation):

- `getVatRecords` now accepts an `includeChargeBuckets` option (default `true`). The
  ledger-generation, monthly-VAT-suggestion and PCN874 callers read only `income`/`expenses`, so they
  pass `false` to skip the per-charge `validateCharge` + business-trip pass that builds the
  `missingInfo` / `differentMonthDoc` / `businessTrips` buckets those callers discard.
- `adjustTaxRecord` passes the enriched charge row (instead of its id) to the transaction/document
  meta helpers, serving the precomputed aggregates from the fast path instead of firing extra
  DataLoader batches per record.
- `validateCharge` is memoized per request (injector-keyed), so the VAT report's bucketing pass and
  the `Charge.validationData` field resolver share a single validation per charge rather than
  computing it twice.
- The VAT report screen dedupes its query document once at module load, keeping a stable query
  reference across renders.
