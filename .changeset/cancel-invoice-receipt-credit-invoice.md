---
'@accounter/server': patch
'@accounter/client': patch
---

Issued invoice-receipts can be cancelled with a credit invoice, like invoices. "Issue Document out
of This Document" is now offered for an invoice-receipt even once it is closed (Green Invoice issues
them closed), and drafts a credit invoice that cancels it. `newDocumentDraftByDocument` takes an
optional `type`; a `CREDIT_INVOICE` draft now sends `linkType: CANCEL` to Green Invoice, carries no
payment lines and no date (Green Invoice dates it on issue), and the original is recorded as
`CANCELLED_BY_OTHER_DOC` instead of `CLOSED`. The issue form keeps the link type in step with the
document type, and the server rejects a cancelling link on anything but a credit invoice. For a
partial credit, a "Cancel the original document" switch in the issue form downgrades the credit
invoice to a plain link; issuing a linked document now only closes linked documents that are still
open.
