---
"@accounter/client": patch
---

Fix the Bank Deposits screen "blinking" when reassigning a transaction. The reassign still triggers
the required `AllDeposits` refetch, but the view no longer blanks out and fully re-renders: loading
gates now only replace the table on the initial load (`fetching && !data`) instead of on every
background refetch, and derived rows are wrapped in a new `useStableValue` hook so the table updates
only when the deposits data actually changes.
