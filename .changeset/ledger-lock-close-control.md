---
'@accounter/server': patch
'@accounter/client': patch
---

Ledger lock now works as a close control:

- The tax-expense, depreciation, recovery-reserve and vacation-reserve generators refuse to generate
  a charge for a locked year (the year-end comparison was broken). Each generator has its own error
  message.
- `LedgerProvider` refuses to insert, update or delete ledger records dated (invoice or value date)
  on or before their owner's lock date. "Locked" is now derived from the lock date instead of the
  per-record `locked` flag, so `lockLedgerRecords` no longer runs an unscoped `UPDATE`.
- New `unlockLedger(date, reason)` mutation moves the lock back to an earlier date. Locking and
  reopening are written to the audit log (who, when, from, to, reason). `lockLedgerRecords` can
  only move the lock forward, and `updateAdminContext` no longer accepts `ledgerLock` (deprecated).
- Annual audit step 8 reads the lock date from a fresh query, refreshes the user context after
  locking, and offers a "Reopen Ledger" dialog.
