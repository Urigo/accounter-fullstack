---
'@accounter/client': patch
---

new `useUpdateDeposit` hook wrapping the mutation with loading toasts; unified `DepositDialog` component that handles both create and edit modes; bank-deposits screen wired up with a **New Deposit** button in the header and a per-row **edit icon** in the table.
"Close Deposit" lives inside the edit dialog as a destructive button that immediately closes with today's date; "Re-open Deposit" appears instead when the deposit is already closed — avoids cluttering the table with a third action column while keeping the operation discoverable.
