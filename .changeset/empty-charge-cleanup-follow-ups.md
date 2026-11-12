---
'@accounter/server': patch
---

Empty-charge cleanup follow-ups:

- A charge holding salary records, business trip employee payments or depreciation records is no
  longer treated as empty, so the cleanup never tries (and fails) to delete it.
- `deleteCharges` now also deletes the charge's balance cancellations, which used to block the
  delete through their foreign key.
- `deleteCharge` now refuses a charge that still holds misc expenses or any of the records above,
  not only transactions and documents.
- `chargeSpreadDocuments` deletes the original charge when spreading leaves it empty, and leaves it
  out of the returned charges.
