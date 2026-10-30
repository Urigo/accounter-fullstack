---
'@accounter/server': minor
'@accounter/mcp-server': minor
---

Expose bank-reported account balances. The server gains `financialAccountBalances(accountIds, asOfDate)`,
which returns, per bank account and currency, the running balance the bank reported on the newest
ingested transaction, with the date it is from. Same-day ties are broken by each bank's own ordering
(Poalim `serial_number` / `event_number`, Discount `operation_order`, Otsar Hahayal's end-of-day
marker) before falling back to insertion time, and `ownerIds` restricts the result to the given
owning businesses. The MCP connector exposes it as `accounter_get_account_balances`, forwarding the
caller's resolved scope as `ownerIds`, measuring freshness against today in Israel, with per-currency
totals and caveats.

Also fixes `Transaction.balance`, which labelled every balance as ILS: it now carries the transaction's
own currency.
