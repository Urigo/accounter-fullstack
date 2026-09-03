---
'@accounter/mcp-server': minor
---

Expose each business's matched tax category on the MCP business directory.

`accounter_list_businesses` returned a business's identity and status but nothing about how its
charges book. A tax category is what a business is *for* in the ledger, so an assistant asked to
categorize a charge, or to check that a counterparty is set up at all, had no way to tell an
unmapped business from one already pointing at "Income" — the directory looked identical either way.
The connector does list tax categories separately, but nothing joined the two: with the mapping
invisible, the model's only honest move was to ask.

Rows now carry `taxCategory` as `{ id, name }`, or `null` when no tax category is mapped to the
business. The `null` is a real answer rather than a missing field: an auto-generated business with
nothing matched yet is exactly the case worth acting on, and the `id` lines up with
`accounter_list_tax_categories` rows without a second lookup.

It reads through the existing `LtdFinancialEntity` inline fragment on `allBusinesses`, alongside
`isClient`, and resolves through the business-id DataLoader — so it batches per page rather than
adding a query per row, and no new upstream field was needed.
