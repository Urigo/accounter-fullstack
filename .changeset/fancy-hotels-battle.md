---
'@accounter/client': patch
'@accounter/server': patch
---

- **Charge Type Filtering**: Added a new multi-select filter that allows users to filter charges by
  their specific concrete type (e.g., SalaryCharge, ConversionCharge) instead of just
  income/expense.
- **Business Trip Filtering**: Introduced a searchable multi-select filter to narrow down charges
  associated with specific business trips.
- **Missing Counterparty Detection**: Added a toggle to identify charges with missing counterparty
  information, specifically targeting transactions without a business or documents missing
  creditor/debtor details.
