---
'@accounter/server': minor
'@accounter/mcp-server': minor
---

- **Server**: new `uncategorizedTransactionGroups` query: transactions with no counterparty,
  grouped by normalised source description, with count, per-currency totals, date range and
  sample transaction and charge ids per group, paged and filterable by date, minimum size and key.
- **MCP**: new read tool `accounter_list_uncategorized_transaction_groups` over it, so an agent
  categorising a new business decides a few hundred groups instead of paging thousands of rows.
