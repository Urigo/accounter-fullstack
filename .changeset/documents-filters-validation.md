---
'@accounter/server': minor
---

Enrich the `documentsByFilters` query and expose per-document validation info.

Added a `validation: DocumentValidationInfo` field to the `FinancialDocument` interface (and its
concrete implementers). Its resolver runs all three document validations — basic required-fields,
VAT and allocation — and combines them into a single informative response with per-check results
(`basicValidation`, `vatValidation`, `allocationValidation`), an aggregated `issues` list and an
overall `isValid` flag.

Added new optional filters to `documentsByFilters`:

- `type`: include only documents of the given document types.
- `missingCounterparty`: include only documents missing a creditor or debtor.
- `missingInfo`: include only documents that fail basic information validation.
- `freeText`: free text search across serial number, total amount (raw and normalized),
  description, remarks and creditor/debtor (counterparty) business names.
