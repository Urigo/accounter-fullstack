---
'@accounter/server': patch
'@accounter/client': patch
---

Issued invoice-receipts can be cancelled with a credit invoice, like invoices. "Issue Document out
of This Document" is now offered for an invoice-receipt even once it is closed (Green Invoice issues
them closed), and drafts a credit invoice that cancels it. `newDocumentDraftByDocument` takes an
optional `type`; a `CREDIT_INVOICE` draft now sends `linkType: CANCEL` to Green Invoice, and the
original is recorded as `CANCELLED_BY_OTHER_DOC` instead of `CLOSED`.
