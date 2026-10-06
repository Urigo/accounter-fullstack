---
'@accounter/mcp-server': minor
---

**Breaking change to tool output:** drop `formatted` from the shared money shape. Every amount the
MCP tools return is now `{ value, currency }` instead of `{ value, formatted, currency }`. Any
consumer that reads `amount.formatted` must build the display string from `value` and `currency`
instead.

`formatted` was the server's display string (e.g. `₪1,234.56`), which a model can rebuild from the
other two fields. It cost bytes on every amount: about 15% of an `accounter_vat_report` row, which
has nine amount fields. The connector no longer selects it from the API. `FinancialAmount.formatted`
stays in the server schema because the client uses it.

The `accounter_vat_report` summary line now formats the total VAT itself, printing the unsigned
amount next to the "to pay" / "refund" wording (e.g. `total VAT ₪42.00 refund`, where it used to
print `-₪42.00`).
