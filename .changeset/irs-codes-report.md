---
'@accounter/server': minor
'@accounter/client': minor
---

- **IRS Codes Report**: a new report (`/reports/irs-codes`, query `irsCodesReport`) that sums
  ledger records for any period by IRS code. Under each code it lists the assigned financial
  entities (businesses and tax categories) with their own sums. An entity with no IRS code falls
  back to its sort code's default IRS code; entities with neither are grouped under Misc at the
  end. Each entity expands into its ledger records. Amounts are local-currency credit minus debit.
