---
'@accounter/mcp-server': minor
---

Expose the monthly VAT report over the MCP connector as `accounter_vat_report`.

The VAT report is the screen accountants and business owners use to prepare the monthly VAT filing,
and it was not reachable from the connector. The new tool is a thin forwarder of the server's
`vatReport` query for one member business and one month (`month: "YYYY-MM"`): which documents
qualify, income vs expense, the VAT figures, the filed totals and the validation reasons are all
computed server-side and passed through as-is, normalized into the connector's shared money and
entity shapes.

**One section per call.** `section` picks `income`, `expenses` (one row per document, every
`VatReportRecord` field) or `missingInfo` (charges that still fail validation, with their `missing`
reasons), paged with `offset`/`limit`. Every call also returns `counts` for all three sections and
`summary`, the month's PCN874 header totals as filed (`totalVat` positive = to pay, negative =
refund), so a model can answer "what's the VAT for March?" from any first call. Rows carry the
reported business as `ownerId`, like the balance report.

**Its own bounds.** The report validates every charge in the month, so the upstream read uses the
long-running budget (`GRAPHQL_UPSTREAM_LONG_TIMEOUT_MS`) — reads can now opt into it, and a
long-running read is not retried after a timeout. Rows are wide, so this tool gets a 120 KB payload
cap; the shared 60 KB cap is unchanged for every other tool. The upstream `chargesType` filter is not
exposed until its inverted behaviour is fixed on the server.

**Glossary.** `accounter_explain_terminology` gains a `report` topic covering the report, its rows,
how income vs expense is decided, the VAT date, every amount field, the summary (including which
PCN874 record types its totals leave out), the record types, and the missing-info section.

The balance report moved to `tools/reports/` alongside it, and GraphQL codegen now covers that
folder.
