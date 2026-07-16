---
'@accounter/server': patch
'@accounter/client': patch
---

Pre-fill financial fields when switching an "other"/"unprocessed" document to a financial type in
the edit-document modal.

A document can be inserted carrying full financial data (date, amount, VAT, serial number,
debtor/creditor, etc.) while still categorized as `OTHER`/`UNPROCESSED`. Previously, editing such a
document and switching its type to a financial one (e.g. invoice) showed all extended attribute
fields empty — the stored values only appeared after saving and reopening the modal, once the
document re-resolved as a `FinancialDocument`.

The financial fields were only exposed on the `FinancialDocument` GraphQL types, so the edit query
could never fetch the already-stored values for `Unprocessed`/`OtherDocument`. These fields (`vat`,
`serialNumber`, `date`, `amount`, `vatReportDateOverride`, `noVatAmount`, `allocationNumber`,
`exchangeRateOverride`, `debtor`, `creditor`) are now exposed on the `Unprocessed` and
`OtherDocument` types and fetched by the client, and the edit form reads its financial defaults from
the document regardless of its current type — so switching to a financial type immediately
pre-fills the stored values.
