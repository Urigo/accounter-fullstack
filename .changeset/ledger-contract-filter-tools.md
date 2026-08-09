---
'@accounter/server': minor
'@accounter/mcp-server': minor
---

Add filterable ledger-record and contract queries, and expose them as dedicated MCP tools.

Server:

- `ledgerRecordsByFilters(filters: LedgerRecordsFilters)` filters ledger records by invoice date,
  value date or either, by the financial entity in any of the four debit/credit account slots, by
  owner and by charge.
- `LedgerRecord` now exposes `ownerId` and `chargeId`.
- `contractsByFilters(filters: ContractsFilters)` filters contracts by admin (owner) business,
  client, contract id and active state.
- `Contract` now exposes `adminId`.

MCP server: new read-only `accounter_get_ledger_records` and `accounter_get_contracts` tools built
on those queries, following the existing business-scoping and output-shaping conventions.
