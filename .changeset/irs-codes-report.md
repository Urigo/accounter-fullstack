---
'@accounter/server': minor
'@accounter/client': minor
---

- **IRS Codes Report**: a new report (`/reports/irs-codes`, query `irsCodesReport`) that sums
  ledger records for any period by IRS code. Under each code it lists the assigned financial
  entities (businesses and tax categories) with their own sums, and entities with no IRS code
  are grouped under Misc at the end. Each entity expands into its ledger records. Amounts are
  local-currency credit minus debit.
