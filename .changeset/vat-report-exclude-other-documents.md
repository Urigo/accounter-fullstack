---
'@accounter/server': patch
---

Exclude non-financial documents from the VAT report's by-date logic (issue #3375).

Documents of type `OTHER` (and other non-financial documents) carry a `date`, so they were returned
by the VAT report's date-filtered document query and registered their linked `charge_id` before the
financial-document type check ran. That pulled unrelated charges into the report's `missingInfo` /
`differentMonthDoc` / `businessTrips` buckets whenever a charge's only in-month tie was a hidden
`OTHER`-document date.

The report now registers a document's charge only after confirming it is a financial (invoice)
document linked to a charge carrying both counterparties, via the new `isVatReportRelevantDocument`
type guard in the vat-report helper (built on the canonical `isInvoice` definition). All callers of
`getVatRecords` — the VAT report screen, PCN874 generation, monthly-VAT ledger validation and
description suggestions — benefit from the corrected filtering.
