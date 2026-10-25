---
'@accounter/server': minor
'@accounter/mcp-server': minor
---

Expose bank-reported account balances. The server gains `financialAccountBalances(accountIds, asOfDate)`,
which returns, per bank account and currency, the running balance the bank reported on the newest
ingested transaction (same-day ties broken by Poalim's own `serial_number` / `event_number`), with the
date it is from. The MCP connector exposes it as `accounter_get_account_balances`, with per-currency
totals and caveats about freshness.

Also fixes `Transaction.balance`, which labelled every balance as ILS: it now carries the transaction's
own currency.
