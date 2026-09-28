---
'@accounter/client': patch
'@accounter/server': patch
---

Surface a charge's depreciation records outside the actions menu. `ChargeMetadata` gains a
`depreciationRecordsCount` field (batched through the existing depreciation-by-charge DataLoader).
The charge extended info shows an optional "Depreciation" section, open by default, when the charge
has depreciation records, and the charges table "More Info" cell shows a `Depreciation: {count}`
tag next to the misc expenses one. The `Depreciation` component now refetches its records after an
add, edit or delete, since the urql client has no cache to invalidate them.
