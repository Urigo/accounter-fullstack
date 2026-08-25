---
'@accounter/client': patch
'@accounter/mcp-server': minor
'@accounter/server': patch
---

Filter charges by financial account.

`ChargeFilter.byFinancialAccounts` has been in the schema for a while but was never implemented:
`allCharges` accepted it and then dropped it on the way to the provider, so it silently matched
everything. It now filters.

- **Server:** the `transactions_by_charge` CTE in `ChargesProvider.getChargesByFilters` aggregates
  `transactions.account_id` into an `account_array`, surfaced through `enriched_charges` and tested
  with an array-overlap predicate — so a charge matches when *any* of its transactions belongs to
  one of the selected accounts, the same shape already used for businesses and tags. The CTE
  already scans `transactions`, so no extra pass is added. The mapping lives in the shared
  `fetchFilteredCharges` helper, which means both All Charges and Missing Info Charges get the
  filter.
- **Client:** a "Financial Accounts" multi-select on the charges filters modal, backed by the
  existing `useGetFinancialAccounts` query. Like every other field it round-trips through the
  `chargesFilters` URL param.
- **MCP:** `byFinancialAccounts` is no longer listed as accepted-but-ignored. Both charge tools
  (`accounter_get_charges`, `accounter_search_charges`) now expose it and pass it upstream.
