---
'@accounter/client': minor
'@accounter/server': minor
---

Annual audit step 09 now locks a final template per report — one for the Balance Sheet and one for
Profit and Loss — and completes once both are locked (`setAnnualAuditStep09Status` takes an
optional `reportType`; omitted locks the template for both). Step 05 opens each report with last
year's final template for it. Years locked with a single template keep using it for both reports.
