---
'@accounter/server': patch
---

- **New Database Migration for SWIFT Fee Handling**: A new PostgreSQL migration is introduced to
  modify the `insert_poalim_swift_transaction_handler` function, ensuring proper processing of SWIFT
  fees.
- **Conditional Fee Transaction Creation**: The updated database function now explicitly checks if
  the calculated `fee_amount` is greater than or equal to zero before creating a transaction record
  for the fee, preventing the creation of transactions for negative fees.
- **Preventing Zero-Amount Ledger Entries**: The `getEntriesFromFeeTransaction` helper function in
  the ledger module has been updated to return early if a fee transaction has a zero amount, thereby
  preventing the creation of unnecessary ledger entries.
