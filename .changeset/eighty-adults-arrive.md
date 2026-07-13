---
'@accounter/client': patch
---

- **GraphQL schema**: `ReportCommentarySubRecord` gains a `ledgerRecords: [LedgerRecord!]!` field,
  so the details are delegated to the client. This applies to both the Profit & Loss and Tax
  reports, which share these commentary types.
- **Client**: `ReportSubCommentaryRow` gains a per-entity `ToggleExpansionButton` that expands into
  the existing `LedgerTable` component (no ledger diff view in this report).
