---
'@accounter/server': minor
'@accounter/client': minor
---

Batch add/remove tags across selected charges from the charges table.

Server: new `batchUpdateChargesTags(chargeIds: [UUID!]!, addTagIds: [UUID!], removeTagIds: [UUID!])`
mutation. It adds and/or removes the given tags on every listed charge while leaving each charge's
other tags untouched (additive/subtractive — unlike `batchUpdateCharges(fields.tags)`, which
replaces a charge's whole tag set). Inserts are idempotent and processing is bounded-concurrency.
Consistent with the existing convention, a tag-only change does **not** degrade accountant approval.

Client: the charges table's selection-column bulk-actions menu gains a "Change tags" action opening
a dialog with Add/Remove modes and a tag multi-select, applied to all selected charges in one
request.
