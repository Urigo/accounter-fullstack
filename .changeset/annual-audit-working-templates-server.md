---
'@accounter/server': minor
---

Annual audit: new `setAnnualAuditWorkingTemplate` mutation stores this year's working Balance Sheet
and Profit and Loss templates on the step 05 status row (per report, or both when `reportType` is
omitted; `null` clears). Renaming a dynamic report template follows it there, and deleting one
removes it.
