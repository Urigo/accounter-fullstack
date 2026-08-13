---
'@accounter/modern-poalim-scraper': minor
'@accounter/server': minor
'@accounter/scraper-app': patch
---

Ingest securities portfolio activity from Bank Hapoalim.

The previous securities work stored *what* an account holds; this adds *what happened* in it —
buys, sells, dividend and interest payments, redemptions, deposit transfers and other corporate
actions — from the "mytrade" order executions history
(`/mytrade/api/v2/json2/order/executions/history`). Nothing reads the stored rows yet.

Because there are now two securities feeds, the static one is renamed throughout so the two are
never confused:

- `modern-poalim-scraper`: `getSecurities` → `getSecuritiesInfo`; `HapoalimSecuritiesSchema` →
  `HapoalimSecuritiesInfoSchema`; the `HapoalimSecurities` / `PoalimSecurity` types →
  `HapoalimSecuritiesInfo` / `PoalimSecurityInfo`. **Breaking** for direct consumers of those
  exports.
- `scraper-app`: payload type `poalim-securities` → `poalim-securities-info`, `poalimSecuritiesVars`
  → `poalimSecuritiesInfoVars`, WebSocket `txnType` `securities` → `securitiesInfo`.

The server's `uploadPoalimSecurities` mutation and the `accounter_schema.poalim_securities` table
keep their names — they are persisted API and schema, and read fine as the reference feed alongside
the new table.

`modern-poalim-scraper` gains `getSecuritiesTransactions(account, range?)`, following the same
`{ data, isValid, errors }` contract as its siblings, plus the exported
`HapoalimSecuritiesTransactions` / `PoalimSecurityTransaction` types. It shares the sibling-tab and
`captureMytradeSession` mechanics with `getSecuritiesInfo` (both now go through a common
`fetchFromMytrade` helper), with two differences: this endpoint is a **GET** — sending it as POST
returns nothing, so `fetchPoalimMytradeWithinPage` took a `method` parameter — and it takes a
`ddMMyyyy` date range, defaulting to the scraper's configured `duration` window.

The response schema is strict rather than permissive, on both the scraper and the scraper-app side:
closed enums for the bank's own vocabularies (transaction and trade types, payment types,
currencies, security groups, the `כן`/`לא` flags), formats for timestamps, ISIN, security numbers
and branch/account strings, ranges for percentages and non-negative amounts, and the cross-field
invariants the bank's data obeys — a buy/sell `TradeType` iff the matching `TransactionType`, the
`PaymentType`/`PaymentDate`/`ExDate` block filled all-or-nothing and never on a trade, the
`FinancialAccount*` strings agreeing with `Branch`/`Account`, one currency across issue/trade/
settlement, and `IsUSEquity` agreeing with the issuer country. The intent is that a bank-side change
is a loud, located failure rather than a silently mis-typed column: every constraint carries a
message naming the field, the offending value and what to widen, and
`describeSecuritiesTransactionsError` annotates each issue with the security and trade date of the
row it came from (the raw Zod path points at `Account.Execution.37.TradeType`, which says nothing
about which execution that is). `PayloadValidationError` now prints a capped `path: message` list
instead of dumping the whole `ZodError` as JSON.

`server` gains `uploadPoalimSecuritiesTransactions(transactions: [PoalimSecurityTransactionInput!]!)`
on the scraper-ingestion module, backed by a new `accounter_schema.poalim_securities_transactions`
table (migration `2026-08-13T12-00-00.add-poalim-securities-transactions-table`) that mirrors the
source fields one-to-one, bank misspellings included (`israe_tax_value`, `peyment_pecentage`,
`trade_currnecy_rate`, `last_tranaction_date`, `fund_plus_accumulated_inerest_value`) so the mapping
stays mechanical. It is owner-scoped with RLS and a `tenant_isolation` policy, and joins to
`poalim_securities` on `security` / `security_key`. The response carries no per-execution id, so
deduplication uses the natural key — account, security, the trade/value/settlement dates, trade and
transaction type, quantity, price, net value and the corporate-action dates — with
`NULLS NOT DISTINCT`, since most of those are null on a plain trade. That key is verified unique
across a full year of real executions; shorter keys are not (two same-day dividends on one security
collide). Re-scrapes are no-ops and restated values are reported through the shared
`changedTransactions` result. Like `poalim_securities`, these rows are not cash movements: no insert
trigger, no `transactions_raw_list` wiring.

`scraper-app` fetches and uploads both securities feeds under the existing per-source option (now
labelled "Fetch securities portfolio (info + activity)"), with separate progress columns for each.

Also extends the foreign-transactions `metadata.messages[].messageCode` lists, which the enumerated
unions rejected on an account whose informational banners differed from the ones already listed.
