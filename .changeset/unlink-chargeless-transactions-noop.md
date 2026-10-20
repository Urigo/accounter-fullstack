---
'@accounter/server': patch
---

`updateTransaction` / `updateTransactions` with `chargeId: EMPTY_UUID` on transactions that are not
linked to any charge no longer fail: the charge is left untouched (there is nothing to unlink) and
the other fields are still updated. The sentinel used to reach the SQL as-is, which tried to write
the nil UUID as the charge ID and failed on its foreign key.
