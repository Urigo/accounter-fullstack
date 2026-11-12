---
'@accounter/server': patch
'@accounter/client': patch
'@accounter/mcp-server': patch
---

Show the tax withheld from a security execution in its own currency. `SecurityExecution` gains
`foreignTaxValue`, `israelTaxValueByPayments` and `capitalTaxValue` — the bank's per-kind withheld
tax, in the settlement currency, which the ledger already books. Until now only `israelTaxValue`
was exposed, so a foreign dividend's tax withheld abroad never showed. `israelTaxValue` itself is now
formatted in the trade currency: the bank's `israe_tax_value` is not in ILS, so it was mislabelled ₪. The
executions table's Tax column lists each non-zero kind, with the Israeli tax figure under them, and the MCP
securities and charge-details tools return the new fields.
