---
'@accounter/server': patch
'@accounter/client': patch
'@accounter/mcp-server': patch
---

Show the tax withheld from a security execution in its own currency. `SecurityExecution` gains
`foreignTaxValue`, `israelTaxValueByPayments` and `capitalTaxValue` — the bank's per-kind withheld
tax, in the settlement currency, which the ledger already books. Until now only `israelTaxValue`
(an ILS figure) was exposed, so a foreign dividend's tax withheld abroad never showed. The
executions table's Tax column lists each non-zero kind, with the ILS figure under them, and the MCP
securities and charge-details tools return the new fields.
