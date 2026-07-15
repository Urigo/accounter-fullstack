---
"@accounter/client": patch
---

Fix the Bank Deposits screen "blinking" when reassigning a transaction, without losing the update.

Previously, reassigning a transaction refetched `AllDeposits`, and the loading gate replaced the
whole table on every refetch — unmounting and remounting the expanded transaction sub-tables, which
is what actually refreshed their data (the urql client has no cache exchange, so mutations don't
invalidate queries). This caused a jarring full-screen blink.

Now the loading gates only replace the table on the initial load (`fetching && !data`), and derived
rows are wrapped in a new `useStableValue` hook so the view updates only when data actually changes.
To keep the data correct without the remount, a reassign bumps a token that every mounted deposit
transaction table observes and re-executes its own query for — so the reassigned row leaves the
source deposit and appears under the target deposit, and both deposits' balances refresh, with no
blink.
