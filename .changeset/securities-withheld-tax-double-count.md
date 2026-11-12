---
'@accounter/server': patch
'@accounter/client': patch
'@accounter/mcp-server': patch
---

Stop double counting Israeli withheld tax on securities executions. The bank reports the Israeli tax
withheld from a dividend or interest payment in both `israel_tax_value_by_payments_settlement_currency`
and `capital_tax_value_settlement_currency`, and the foreign-securities ledger added the two, so it
booked twice the tax (and an inflated gross income) and flagged every such charge with "withheld tax
… does not match gross minus net". The capital tax column now only stands in when the Israeli column
is empty. The executions table no longer lists a capital tax line that repeats the Israeli one, and
the `capitalTaxValue` schema description and MCP securities tool say it is not additive. Regenerate the
ledger of affected charges.
