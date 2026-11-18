---
'@accounter/server': minor
'@accounter/client': minor
'@accounter/shaam6111-generator': patch
---

SHAAM 6111: the header comes from stored per-business, per-year settings (edited on the 6111 header
tab; the audit opinion is set every year) instead of hard-coded values, and unset fields are
flagged. Tax-adjustment lines 120/130 (depreciation), 182 (financing expenses on tax debts) and 183
(donations, from a new `donationsTaxCategoryId` admin-context category) are computed, and any
non-total line takes a manual, audit-logged amount through `updateShaam6111` (the unimplemented
`shaam6111ByYear` query is removed). Entities get a `contraIrsCode` for balances on the opposite
side of their usual one. The tax computation uses the reported business's admin context. Annual
audit step 16 can only be marked done once the year's 6111 validates. The generator right-aligns
the business description, per the spec.
