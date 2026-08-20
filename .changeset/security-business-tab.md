---
'@accounter/server': minor
'@accounter/client': minor
---

Give each security a page: its holding and its full execution history.

A security business had no view of its own — its trades were visible one charge at a time, and the
only way to see what is held was to add the executions up by hand. The business page now grows a
**Security** tab, shown for any business carrying a `businesses_securities` row, with:

- **a position summary** — units held, weighted average cost per unit bought, totals bought and sold,
  alongside the security's ISIN, symbol, exchange, currency, type and ETF/foreign badges;
- **the full execution history** across every Poalim key the security is known by, oldest first, each
  row linking to the charge behind its cash movement (and reading as `—` when no movement matched).

A security with no ingested executions reports null amounts rather than zeroes: there is no
currency to state them in, and `formatFinancialAmount` would fall back to the local one and turn
"nothing is known" into a confident ILS 0. The card renders those as an em dash.

The position is **derived, and says so**: holdings are not scraped, so the card states the date the
ingested history starts from and that anything held before it is not counted. Corporate actions that
change the unit count without an execution row are invisible for the same reason. Cash-only actions
(dividends, interest) leave the count alone; buys, distributions and transfers in add; sales,
redemptions and transfers out subtract.

Schema: `Query.securityBusinessHistory(businessId: UUID!)` returning `SecurityBusinessHistory`
(`SecurityPosition` + `SecurityHistoryExecution`, an execution with the transaction and charge behind
it). The pairing is the same one the charge view shows, read from the other end — the security
business's own transactions matched against its executions by
`matchExecutionsToTransactions`. The tab runs its own query, like the Charges/Transactions/Ledger
tabs, so a business page does not pay for execution history it never shows.

The charge panel's "Portfolio activity" table and the new one are now the same component
(`components/securities/security-executions-table.tsx`) over one fragment, so the two always read
alike; the charge panel gains nothing else.
