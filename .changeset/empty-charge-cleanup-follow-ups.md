---
'@accounter/server': patch
---

Empty-charge cleanup follow-ups:

- A charge holding salary records, business trip employee payments, depreciation records or
  balance cancellations is no longer treated as empty, so the cleanup never tries (and fails) to
  delete it.
- `deleteCharge` now refuses a charge that still holds misc expenses or any of the records above,
  not only transactions and documents.
- `chargeSpreadDocuments` deletes the original charge when spreading leaves it empty, and leaves it
  out of the returned charges.
