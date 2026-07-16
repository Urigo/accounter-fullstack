---
'@accounter/server': patch
---

Automatically degrade a charge's accountant approval (`APPROVED` → `PENDING`) whenever its underlying
data changes, so an already-approved charge is re-flagged for accountant review.

A shared `degradeChargesAccountantApproval` helper (built on
`AccountantApprovalProvider.degradeChargeAccountantApproval`) is now invoked from every
charge-mutating operation:

- **Documents** — upload / batch-upload / Google-Drive batch-upload / insert / update (former and
  new charge) / delete / charge-spread.
- **Transactions** — `updateTransaction` and `updateTransactions`, degrading both the former and the
  new charge.
- **Misc expenses** — insert / bulk-insert / update (former and new charge) / delete.
- **Charges** — `updateCharge`, `batchUpdateCharges` and `mergeCharges`. Tag-only changes and
  explicit accountant-approval changes are intentionally excluded.
- **Ledger** — `regenerateLedgerRecords`.
- **Cron** — `mergeChargesByTransactionReference`.

The helper de-duplicates ids and ignores empty / `EMPTY_UUID` values (degrading a non-approved
charge is a no-op), and returns the freshly-degraded charges so mutations respond with the up-to-date
`PENDING` status rather than a stale one.
