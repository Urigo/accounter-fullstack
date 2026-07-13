---
'@accounter/server': patch
---

- **Server**: `recordsByFinancialEntityIdAndSortCodeValidations`
  (`packages/server/src/modules/reports/helpers/misc.helper.ts`) now collects the contributing
  ledger records (deduplicated by record ID) alongside the per-entity amount aggregation.
- **GraphQL schema**: `ReportCommentarySubRecord` gains a `ledgerRecords: [LedgerRecord!]!` field,
  so the details are delegated to the client. This applies to both the Profit & Loss and Tax
  reports, which share these commentary types.
