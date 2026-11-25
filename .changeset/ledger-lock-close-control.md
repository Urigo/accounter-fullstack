---
'@accounter/server': patch
'@accounter/client': patch
---

Ledger lock now works as a close control. It has two parts:

- **Lock date** (`ledger_lock`): `LedgerProvider` refuses to insert, update or delete ledger
  records dated (invoice or value date) on or before their owner's lock date.
- **Per-record lock** (`ledger_records.locked`): locking flags the business's records dated up to
  the lock date. Flagged records can't be updated or deleted, even after the lock date is moved
  back. The flagging `UPDATE` is now scoped to the business.

Also:

- The tax-expense, depreciation, recovery-reserve and vacation-reserve generators refuse to generate
  a charge for a locked year (the year-end comparison was broken). Each generator has its own error
  message.
- New `unlockLedger(date, reason)` mutation moves the lock date back to an earlier date, which
  allows new entries (such as audit adjustments) in the reopened period. Records already locked stay
  locked. Locking and reopening are written to the audit log (who, when, from, to, reason) in the
  same transaction as the lock change. `lockLedgerRecords` can only move the lock forward (locking
  to the current date is a no-op), and `updateAdminContext` no longer accepts `ledgerLock`
  (deprecated).
- Annual audit step 8 reads the lock date from a fresh query, refreshes the user context after
  locking, and offers a "Reopen Ledger" dialog.
