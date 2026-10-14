---
'@accounter/server': patch
---

Insert a manual ledger record without a charge.

**Server (`@accounter/server`)**

- `insertLedgerRecord`'s `chargeId` is now optional. Without it, a new charge of the request's
  business is created, described by the record's description (else its reference), and the misc
  expense or document and the ledger record are saved on it. The charge, the entity and the record
  are saved together or not at all. The record is validated exactly as before, including the ledger
  lock date and entity ownership, before anything is written.
