---
'@accounter/server': minor
'@accounter/client': minor
---

Show which account a security is held in, and where a transfer between accounts went.

- **Accounts in GraphQL.** `SecurityExecution.account` names the portfolio account an execution was
  made in, as a `SecurityAccount` (bank, branch and account numbers, plus the owner's matching
  `FinancialAccount` when one is registered). `SecurityHolding.accounts` and
  `SecurityBusinessHistory.accounts` split a position by account: each account's own executions add
  up to its share, and a transfer between two of the owner's accounts moves units from one to the
  other.
- **Transfers paired in GraphQL.** `SecurityExecution.transferCounterpart` is a transfer's other leg,
  paired exactly as FIFO pairs it to move lots: the same units, into another of the owner's
  accounts, within 10 days. The pairing is now one exported helper, `pairSecurityTransfers`, that
  the cost basis uses too.
- **Securities screen.** A "Split by account" toggle turns the table into a row per security and
  account, with an Account column the search also matches.
- **Charge panel.** Each security names the account its trades were made in, and adds an Account
  column to its activity when they span more than one.
- **Security page.** A security held in more than one account gets a by-account breakdown under its
  totals, and an Account column in its execution history.
- **Transfers in execution tables.** A paired transfer names the account the units went to or came
  from. A transfer in with no transfer out behind it is flagged "Unknown cost", since selling those
  units from that account cannot be costed; a transfer out that arrived nowhere reads "Left your
  accounts".
