---
'@accounter/server': patch
---

Match more Poalim securities executions to the cash movement behind them. The matcher required the
transaction's debit date to equal the execution's value date, but the two feeds disagree on dates:
foreign-currency rows are debited around the trade date and executed on the settlement day, a
back-dated correction is executed when posted, and a new issue can settle days late. A pair is now
identified by account, security key, exact amount and direction. The date only ranks candidates: an
exact debit-date or event-date match first, then the closest date within a settlement window.

Also:

- Domestic trades and securities fees carry the security key in their reference, not their
  description, and are now recognized by it.
- An amount column the feed leaves at `0` gives way to the next column in the same currency. This
  fixes shekel trades, whose cash is reported in the NIS column, and their FIFO purchase cost.
- A cancelled execution is expected to move cash the other way. Before, it could take the original
  payment's transaction.
- Fee transactions no longer compete with main transactions for an execution.
- The foreign-securities ledger reports a dividend or interest commission that has no matching fee
  transaction in the charge, and a cancelled income payment it cannot book as a reversal yet.
