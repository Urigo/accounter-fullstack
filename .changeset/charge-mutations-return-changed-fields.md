---
'@accounter/server': patch
'@accounter/client': patch
---

Charge mutations now return the charge's new state, not just its id. `updateCharge`,
`batchUpdateCharges`, `mergeCharges` and `batchUpdateChargesTags` select the charges table row's
eagerly-loaded fields (the new `ChargeMutationResultFields` fragment), a prerequisite for the
normalized client cache. `mergeCharges` also stops responding with the base charge as it was loaded
before the update and merge, which showed the pre-merge description, approval and type whenever the
approval wasn't degraded.
